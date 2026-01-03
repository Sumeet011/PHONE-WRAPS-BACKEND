const orderModel = require("../../Models/Order/Order.model.js");
const userModel = require("../../Models/User/User.model.js");
const cartModel = require("../../Models/Cart/Cart.model.js");
const couponModel = require("../../Models/Coupon/Coupon.model.js");
const productModel = require("../../Models/Products/Product.model.js");
const collectionModel = require("../../Models/Collection/Collection.model.js");
const { useCoupon } = require("./coupon.controller.js");
const { createShipment } = require("../utils/iThinkLogistics.js");
const Razorpay = require('razorpay');
const validator = require("validator");
require('dotenv').config();

// global variables
const currency = 'inr'
const deliveryCharge = 5

// Verify environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error('❌ ERROR: Razorpay credentials missing!');
    console.error('Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file');
}

// gateway initialize
let razorpayInstance;
try {
    razorpayInstance = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
    });
    console.log('✓ Razorpay initialized successfully');
} catch (error) {
    console.error('❌ Failed to initialize Razorpay:', error.message);
}

// Input sanitization
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return validator.escape(input.trim());
    }
    return input;
};

// Validate order data
const validateOrderData = (orderData) => {
    const errors = [];
    
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        errors.push("Order must contain at least one item");
    }
    
    if (!orderData.amount || orderData.amount < 0) { // Allow 0 for fully discounted orders
        errors.push("Invalid order amount");
    }
    
    if (!orderData.address) {
        errors.push("Delivery address is required");
    } else {
        const address = orderData.address;
        if (!address.firstName || !address.lastName || !address.email || 
            !address.street || !address.city || !address.country || 
            !address.zipcode || !address.phone) {
            errors.push("All address fields are required");
        }
        
        if (!validator.isEmail(address.email)) {
            errors.push("Invalid email address");
        }
        
        if (!validator.isMobilePhone(address.phone, 'any')) {
            errors.push("Invalid phone number");
        }
    }
    
    return errors;
};

// Calculate order total
const calculateOrderTotal = (items, deliveryFee = 0, discount = 0) => {
    const subtotal = items.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
    
    const finalTotal = subtotal + deliveryFee - discount;
    return finalTotal < 0 ? 0 : finalTotal;
};

/**
 * Process collection items and convert to actual product orders
 * If quantity >= 5: User gets ALL cards in collection
 * If quantity < 5: User gets random unique gaming cards not owned yet
 */
const processCollectionItems = async (userId, collectionItem) => {
    try {
        const { productId: collectionId, quantity, selectedBrand, selectedModel, price } = collectionItem;
        
        console.log(`🎴 Processing collection ${collectionId} for user ${userId}`);
        
        // Fetch collection details
        const collection = await collectionModel.findById(collectionId).populate('Products');
        if (!collection) {
            console.error(`❌ Collection not found: ${collectionId}`);
            throw new Error(`Collection not found: ${collectionId}`);
        }

        console.log(`✓ Found collection: ${collection.name} with ${collection.Products?.length || 0} products`);

        // Get user's already owned products (handle guest users)
        let ownedProductIds = [];
        const mongoose = require('mongoose');
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            try {
                const user = await userModel.findById(userId).select('unlockedProducts');
                ownedProductIds = user?.unlockedProducts?.map(id => id.toString()) || [];
                console.log(`✓ User owns ${ownedProductIds.length} products`);
            } catch (err) {
                console.warn(`⚠️ Could not fetch user products: ${err.message}`);
            }
        } else {
            console.log(`⚠️ Guest user or invalid userId, treating as no owned products`);
        }

        // Filter gaming products from collection
        const gamingProducts = collection.Products.filter(product => 
            product.type === 'gaming' && product.level
        );

        if (gamingProducts.length === 0) {
            throw new Error(`No gaming products found in collection: ${collection.name}`);
        }

        let selectedProducts = [];

        if (quantity >= 5) {
            // Complete collection: User gets ALL cards
            console.log(`✓ Complete collection order: All ${gamingProducts.length} cards`);
            selectedProducts = gamingProducts.slice(0, 5); // Take first 5 cards
        } else {
            // Incomplete: Select random unique cards not owned by user
            const availableProducts = gamingProducts.filter(product => 
                !ownedProductIds.includes(product._id.toString())
            );

            if (availableProducts.length === 0) {
                // If user owns all, allow any random cards
                console.warn(`⚠️ User owns all products, selecting from full collection`);
                selectedProducts = gamingProducts
                    .sort(() => Math.random() - 0.5)
                    .slice(0, quantity);
            } else {
                // Select random unique cards from available
                selectedProducts = availableProducts
                    .sort(() => Math.random() - 0.5)
                    .slice(0, Math.min(quantity, availableProducts.length));
            }

            console.log(`✓ Random selection: ${selectedProducts.length} cards from ${availableProducts.length} available`);
        }

        // Convert to order items
        const orderItems = selectedProducts.map(product => ({
            itemType: 'product', // Convert collection to individual products
            productId: product._id,
            productName: product.name,
            collectionId: collection._id,
            collectionName: collection.name,
            collectionImage: collection.heroImage,
            phoneModel: selectedModel,
            selectedBrand,
            selectedModel,
            quantity: 1,
            price: price / quantity, // Divide price evenly
            image: product.image || product.images?.[0] // Handle both single image and images array
        }));

        console.log(`✓ Created ${orderItems.length} order items with images`);
        return orderItems;
    } catch (error) {
        console.error('❌ Error processing collection:', error.message);
        throw error;
    }
};

// Placing orders using Stripe Method
const placeOrderStripe = async (req,res) => {
    try {
        const { items, amount, address, coupon } = req.body;
        const { origin } = req.headers;

        const validationErrors = validateOrderData({ items, amount, address });
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(', ') });
        }

        const sanitizedAddress = {
            firstName: sanitizeInput(address.firstName),
            lastName: sanitizeInput(address.lastName),
            email: sanitizeInput(address.email),
            street: sanitizeInput(address.street),
            city: sanitizeInput(address.city),
            state: sanitizeInput(address.state),
            country: sanitizeInput(address.country),
            zipcode: sanitizeInput(address.zipcode),
            phone: sanitizeInput(address.phone)
        };

        let discount = 0;
        if (coupon) {
            const couponData = await couponModel.findOne({code:coupon});
            if (couponData) {
                const subtotal = calculateOrderTotal(items);
                discount = (subtotal * couponData.discount)/100;
            }
        }

        const expectedTotal = calculateOrderTotal(items, deliveryCharge, discount);
        
        const newOrder = new orderModel({
            userId: req.body.userId,
            items: items.map(item => ({
                ...item,
                name: sanitizeInput(item.name)
            })),
            amount: expectedTotal,
            address: sanitizedAddress,
            paymentMethod: "Stripe",
            date: Date.now()
        });
        
        await newOrder.save();
        await userModel.findByIdAndUpdate(req.body.userId, { cartData: {} });

        if (coupon) {
            await couponModel.findOneAndUpdate({ code: coupon }, { $inc: { usedCount: 1 } });
        }

        const line_items = items.map((item) => ({
            price_data: {
                currency: currency,
                product_data: { name: sanitizeInput(item.name) },
                unit_amount: Math.round(item.price * 100)
            },
            quantity: item.quantity
        }));

        if (deliveryCharge > 0) {
            line_items.push({
                price_data: {
                    currency: currency,
                    product_data: { name: 'Delivery Charges' },
                    unit_amount: Math.round(deliveryCharge * 100)
                },
                quantity: 1
            });
        }

        if (discount > 0) {
            line_items.push({
                price_data: {
                    currency: currency,
                    product_data: { name: 'Discount' },
                    unit_amount: -Math.round(discount * 100),
                },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
            cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
            line_items,
            mode: 'payment',
            customer_email: sanitizedAddress.email,
            metadata: { orderId: newOrder._id.toString(), userId: req.body.userId }
        });

        res.json({ success: true, session_url: session.url });
    } catch (error) {
        console.error('Stripe order error:', error);
        res.status(500).json({ success: false, message: 'Payment processing failed' });
    }
}


// Create order in DB and get orderId for Razorpay
const createRazorpayOrder = async (req, res) => {
    try {
        console.log('📦 Creating Razorpay Order - Request body:', req.body);
        
        const { items, address, coupon, userId } = req.body;
        console.log('🎟️ Coupon data received:', coupon, 'Type:', typeof coupon, 'IsArray:', Array.isArray(coupon));

        // Defensive: ensure items is a non-empty array
        if (!items || !Array.isArray(items) || items.length === 0) {
            console.error('❌ Items validation failed:', items);
            return res.status(400).json({ success: false, message: "Order must contain at least one item" });
        }

        // Validate userId - must be a valid MongoDB ObjectId
        const mongoose = require('mongoose');
        let validUserId;
        
        if (!userId || userId === 'guest' || userId.startsWith('guest_')) {
            // Create a temporary guest user or use a default guest user ID
            console.log('⚠️ Guest user detected, creating guest user...');
            
            try {
                // Try to find existing user by email or phone
                let guestUser = await userModel.findOne({ 
                    $or: [
                        { email: address.email },
                        { phoneNumber: address.phone }
                    ]
                });
                
                if (!guestUser) {
                    // Generate unique username from email or timestamp
                    const baseUsername = address.email.split('@')[0];
                    const timestamp = Date.now();
                    const uniqueUsername = `${baseUsername}_${timestamp}`;
                    
                    guestUser = new userModel({
                        username: uniqueUsername,
                        email: address.email,
                        phoneNumber: address.phone,
                        profilePicture: '',
                        Address: `${address.street}, ${address.city}, ${address.state || address.city}`,
                        score: 0
                    });
                    await guestUser.save();
                    console.log('✓ Guest user created:', guestUser._id);
                } else {
                    console.log('✓ Existing user found:', guestUser._id);
                }
                
                validUserId = guestUser._id;
            } catch (err) {
                console.error('❌ Failed to create guest user:', err.message);
                return res.status(400).json({ 
                    success: false, 
                    message: "Failed to create user account. Please try again." 
                });
            }
        } else if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.error('❌ Invalid userId format:', userId);
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        } else {
            validUserId = userId;
        }

        console.log('✓ Valid UserId:', validUserId);
        console.log('✓ Items:', items.length, 'items');

        // Process collection items - convert them to actual products
        const processedItems = [];
        for (const item of items) {
            if (item.type === 'collection') {
                try {
                    console.log(`🎴 Processing collection: ${item.name || item.productId}`);
                    const collectionProducts = await processCollectionItems(validUserId, item);
                    processedItems.push(...collectionProducts);
                    console.log(`✓ Collection expanded to ${collectionProducts.length} products`);
                } catch (collectionError) {
                    console.error(`❌ Failed to process collection:`, collectionError.message);
                    // Fallback: Add collection as-is if processing fails
                    const fallbackItem = {
                        itemType: 'collection',
                        productId: item.productId,
                        productName: item.name || 'Collection',
                        phoneModel: item.selectedModel || item.selectedBrand || 'Universal',
                        selectedBrand: item.selectedBrand,
                        selectedModel: item.selectedModel,
                        quantity: item.quantity,
                        price: item.price
                    };
                    // Add collection image if available
                    if (item.collectionDetails?.heroImage) {
                        fallbackItem.collectionImage = item.collectionDetails.heroImage;
                    }
                    processedItems.push(fallbackItem);
                }
            } else {
                // Regular product, custom-design, or suggested product
                const orderItem = {
                    itemType: item.type || 'product',
                    productId: item.productId,
                    productName: item.productDetails?.name || item.name || (item.type === 'custom-design' ? 'Custom Design' : 'Product'),
                    phoneModel: item.selectedModel || item.selectedBrand || 'Universal',
                    selectedBrand: item.selectedBrand,
                    selectedModel: item.selectedModel,
                    quantity: item.quantity,
                    price: item.price
                };
                
                // Add image for products and suggested products
                if (item.productDetails?.images?.[0]) {
                    orderItem.image = item.productDetails.images[0];
                } else if (item.productDetails?.image) {
                    orderItem.image = item.productDetails.image;
                } else if (item.image) {
                    orderItem.image = item.image;
                }
                
                // Only add customDesign for custom-design items
                if (item.type === 'custom-design' && item.customDesign) {
                    orderItem.customDesign = item.customDesign;
                }
                
                processedItems.push(orderItem);
            }
        }

        console.log(`✓ Processed items: ${items.length} cart items → ${processedItems.length} order items`);

        // Calculate totals using ORIGINAL cart prices (not processed/divided prices)
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = deliveryCharge;
        
        // Handle multiple coupons
        let appliedCoupons = [];
        let totalDiscount = 0;
        
        if (Array.isArray(coupon) && coupon.length > 0) {
            // Multiple coupons from new system
            appliedCoupons = coupon.map(c => ({
                code: c.code,
                discountPercentage: c.discountPercentage,
                discountAmount: c.discountAmount
            }));
            totalDiscount = appliedCoupons.reduce((sum, c) => sum + c.discountAmount, 0);
            
            // Increment usage count for all coupons
            for (const c of appliedCoupons) {
                await couponModel.findOneAndUpdate(
                    { code: c.code }, 
                    { $inc: { usedCount: 1 } }
                );
            }
        } else if (typeof coupon === 'string' && coupon) {
            // Legacy single coupon support
            const couponData = await couponModel.findOne({ code: coupon });
            if (couponData) {
                const discountAmount = Math.round((subtotal * couponData.discountPercentage) / 100);
                appliedCoupons = [{
                    code: couponData.code,
                    discountPercentage: couponData.discountPercentage,
                    discountAmount: discountAmount
                }];
                totalDiscount = discountAmount;
                await couponModel.findOneAndUpdate(
                    { code: coupon }, 
                    { $inc: { usedCount: 1 } }
                );
            }
        }
        
        const totalAmount = subtotal + shippingCost - totalDiscount;

        console.log('✓ Subtotal:', subtotal);
        console.log('✓ Shipping:', shippingCost);
        console.log('✓ Total:', totalAmount);

        // Generate unique order ID
        const orderIdStr = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const orderNumber = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

        // Format items for the schema - use PROCESSED items (individual gaming cards with images)
        // This ensures gaming collection products show as individual cards with their details
        const formattedItems = processedItems.map(item => {
            let productObjectId;
            
            // Try to convert productId to ObjectId, if it fails, create a new ObjectId
            if (mongoose.Types.ObjectId.isValid(item.productId)) {
                productObjectId = item.productId;
            } else {
                console.log(`⚠️ Invalid productId format: ${item.productId}, creating placeholder`);
                productObjectId = new mongoose.Types.ObjectId();
            }
            
            const formattedItem = {
                itemType: item.itemType || 'product',
                productId: productObjectId,
                productName: item.productName,
                phoneModel: item.phoneModel,
                selectedBrand: item.selectedBrand,
                selectedModel: item.selectedModel,
                quantity: item.quantity,
                price: item.price
            };

            // Add optional fields if they exist
            if (item.collectionId) formattedItem.collectionId = item.collectionId;
            if (item.collectionName) formattedItem.collectionName = item.collectionName;
            if (item.collectionImage) formattedItem.collectionImage = item.collectionImage;
            if (item.image) formattedItem.image = item.image;
            if (item.customDesign) formattedItem.customDesign = item.customDesign;

            return formattedItem;
        });
        
        console.log(`✓ Formatted ${formattedItems.length} items for order with images:`, 
            formattedItems.map(i => ({ name: i.productName, hasImage: !!i.image, hasCollectionImage: !!i.collectionImage })));

        // Format shipping address for the schema
        const shippingAddress = {
            fullName: `${address.firstName} ${address.lastName}`,
            phoneNumber: address.phone,
            email: address.email,
            addressLine1: address.street,
            addressLine2: '',
            city: address.city,
            state: address.state || address.city,
            zipCode: address.zipcode,
            country: address.country || 'India'
        };

        const orderData = {
            orderId: orderIdStr,
            orderNumber: orderNumber,
            userId: validUserId,
            items: formattedItems,
            subtotal: subtotal,
            discount: totalDiscount,
            shippingCost: shippingCost,
            totalAmount: totalAmount,
            status: 'Pending',
            paymentMethod: 'Razorpay',
            paymentStatus: 'Pending',
            isPaid: false,
            shippingAddress: shippingAddress,
            appliedCoupons: appliedCoupons,
            // Legacy fields for backward compatibility
            couponCode: appliedCoupons.length > 0 ? appliedCoupons[0].code : null,
            couponDiscount: totalDiscount
        };

        console.log('📋 Order data prepared');
        console.log('🎟️ Order appliedCoupons:', orderData.appliedCoupons);
        console.log('🎨 Order items with customDesign:', orderData.items.filter(i => i.customDesign).map(i => ({
            productName: i.productName,
            hasCustomDesign: !!i.customDesign,
            designImageUrl: i.customDesign?.designImageUrl,
            originalImageUrl: i.customDesign?.originalImageUrl
        })));

        const newOrder = new orderModel(orderData);
        
        console.log('💾 Saving order to database...');
        await newOrder.save();
        console.log('✓ Order saved with ID:', newOrder._id);

        console.log('✅ Order created successfully!');
        res.json({ success: true, orderId: newOrder._id, orderIdStr: orderIdStr });
    } catch (error) {
        console.error('❌ Razorpay order creation error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Order creation failed',
            error: error.message 
        });
    }
}

// Create Razorpay payment session
const placeOrderRazorpay = async (req, res) => {
    try {
        const { items, coupon } = req.body;

        // Defensive: ensure items is a non-empty array
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Order must contain at least one item" });
        }

        // Calculate subtotal
        const subtotal = calculateOrderTotal(items);
        
        // Handle multiple coupons (array) or single coupon (string)
        let totalDiscount = 0;
        
        if (Array.isArray(coupon) && coupon.length > 0) {
            // Multiple coupons - use discountAmount directly from each coupon object
            console.log('🎟️ Processing multiple coupons:', coupon.length);
            totalDiscount = coupon.reduce((sum, c) => {
                const amount = c.discountAmount || 0;
                console.log(`  - ${c.code}: ₹${amount}`);
                return sum + amount;
            }, 0);
        } else if (typeof coupon === 'string' && coupon) {
            // Legacy single coupon support
            const couponData = await couponModel.findOne({code:coupon});
            if (couponData) {
                const percent = couponData.discountPercentage || couponData.discount || 0;
                totalDiscount = (subtotal * percent) / 100;
                console.log(`🎟️ Single coupon ${coupon}: ${percent}% = ₹${totalDiscount}`);
            }
        }

        let totalAmount = subtotal + deliveryCharge - totalDiscount;

        // Defensive: prevent NaN
        if (isNaN(totalAmount)) {
            return res.status(400).json({ success: false, message: "Order total calculation failed" });
        }

        // Allow 0 for fully discounted orders
        if (totalAmount < 0) {
            console.log('⚠️ Total amount is negative, setting to 0');
            totalAmount = 0;
        }

        console.log('💰 Razorpay Order Calculation:');
        console.log(`  Subtotal: ₹${subtotal}`);
        console.log(`  Discount: -₹${totalDiscount}`);
        console.log(`  Shipping: ₹${deliveryCharge}`);
        console.log(`  TOTAL: ₹${totalAmount}`);

        const options = {
            amount: Math.round(totalAmount * 100),
            currency: currency.toUpperCase(),
            receipt: Date.now().toString()
        };

        const order = await razorpayInstance.orders.create(options);
        console.log('✅ Razorpay order created:', order.id, 'Amount:', order.amount / 100);
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('Razorpay order error:', error);
        res.status(500).json({ success: false, message: 'Payment initialization failed' });
    }
}

const verifyRazorpay = async (req, res) => {
    try {
        console.log('🔍 Verifying Razorpay payment...');
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;
        
        console.log('📦 Full orderData received:', JSON.stringify(orderData, null, 2));
        console.log('🎨 Items from orderData:', orderData?.items);
        console.log('🖼️ Items with customDesign:', orderData?.items?.filter(i => i.customDesign));
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing payment verification data" });
        }

        if (!orderData) {
            return res.status(400).json({ success: false, message: "Order data is required" });
        }

        console.log('📋 Payment IDs:', { razorpay_order_id, razorpay_payment_id });

        // Fetch order info from Razorpay
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
        console.log('📦 Razorpay order status:', orderInfo.status);
        
        if (orderInfo.status === 'paid') {
            console.log('✅ Payment verified successfully! Creating order in database...');
            
            // Now create the order in database AFTER successful payment
            const { items, address, coupon: rawCoupon, userId } = orderData;

            console.log('🎟️ Coupon data received in verifyRazorpay:', rawCoupon, 'Type:', typeof rawCoupon, 'IsArray:', Array.isArray(rawCoupon));
            
            // Keep appliedCoupons as array
            const appliedCoupons = (Array.isArray(rawCoupon) && rawCoupon.length > 0) 
                ? rawCoupon 
                : [];

            const mongoose = require('mongoose');
            let validUserId;
            let isNewUser = false;
            let userToken = null;
            
            // Handle guest users OR invalid userId
            if (!userId || userId === 'guest' || userId.startsWith('guest_')) {
                console.log('⚠️ Guest user detected (no userId provided), finding/creating user...');
                console.log('📧 Address data:', JSON.stringify(address, null, 2));
                console.log('📧 Email:', address.email);
                console.log('📱 Phone:', address.phone);
                console.log('👤 First Name:', address.firstName);
                console.log('👤 Last Name:', address.lastName);
                
                let guestUser = await userModel.findOne({ 
                    $or: [
                        { email: address.email },
                        { phoneNumber: address.phone }
                    ]
                });
                
                console.log('🔍 Existing user search result:', guestUser ? 'Found' : 'Not found');
                
                if (!guestUser) {
                    console.log('👤 Creating new user...');
                    
                    // Use the full name from checkout form or email as fallback
                    const fullName = `${address.firstName || ''} ${address.lastName || ''}`.trim();
                    const baseUsername = fullName || address.email.split('@')[0];
                    const timestamp = Date.now();
                    const uniqueUsername = `${baseUsername}_${timestamp}`;
                    
                    // Generate random password for guest user
                    const bcrypt = require('bcryptjs');
                    const randomPassword = Math.random().toString(36).slice(-10) + Date.now().toString(36);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);
                    
                    console.log('✏️ Username will be:', uniqueUsername);
                    console.log('📝 Full name:', fullName);
                    
                    guestUser = new userModel({
                        username: uniqueUsername,
                        email: address.email,
                        phoneNumber: address.phone,
                        password: hashedPassword,
                        profilePicture: '',
                        Address: `${address.street}, ${address.city}, ${address.state || address.city}`,
                        score: 0,
                        isVerified: true,
                        emailVerified: true
                    });
                    
                    console.log('💾 Attempting to save user:', {
                        username: guestUser.username,
                        email: guestUser.email,
                        phoneNumber: guestUser.phoneNumber
                    });
                    
                    try {
                        await guestUser.save();
                        console.log('✅ Guest user created successfully! ID:', guestUser._id);
                        isNewUser = true;
                    } catch (saveError) {
                        // If duplicate key error, try to find the existing user again
                        if (saveError.code === 11000) {
                            console.log('⚠️ Duplicate key detected, fetching existing user...');
                            guestUser = await userModel.findOne({ 
                                $or: [
                                    { email: address.email },
                                    { phoneNumber: address.phone }
                                ]
                            });
                            if (guestUser) {
                                console.log('✓ Found existing user after duplicate error:', guestUser._id);
                            } else {
                                console.error('❌ Could not find user after duplicate error');
                                throw saveError;
                            }
                        } else {
                            console.error('❌ Error saving user to database:', saveError);
                            throw saveError;
                        }
                    }
                } else {
                    console.log('✓ Existing user found:', guestUser._id);
                }
                
                validUserId = guestUser._id;
                
                // Generate token for auto-login
                const jwt = require('jsonwebtoken');
                userToken = jwt.sign(
                    { id: guestUser._id },
                    process.env.JWT_SECRET || 'your-secret-key-change-this',
                    { expiresIn: '30d' }
                );
            } else if (!mongoose.Types.ObjectId.isValid(userId)) {
                console.error('❌ Invalid userId format:', userId);
                return res.status(400).json({ success: false, message: "Invalid user ID format" });
            } else {
                // Check if user actually exists in database
                console.log('🔍 Checking if user exists in database:', userId);
                const existingUser = await userModel.findById(userId);
                
                if (!existingUser) {
                    console.log('⚠️ User ID provided but user does not exist in DB. Creating user from address data...');
                    console.log('📧 Address data:', JSON.stringify(address, null, 2));
                    
                    // User doesn't exist, create new user from address data
                    const fullName = `${address.firstName || ''} ${address.lastName || ''}`.trim();
                    const baseUsername = fullName || address.email.split('@')[0];
                    const timestamp = Date.now();
                    const uniqueUsername = `${baseUsername}_${timestamp}`;
                    
                    // Generate random password for new user
                    const bcrypt = require('bcryptjs');
                    const randomPassword = Math.random().toString(36).slice(-10) + Date.now().toString(36);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);
                    
                    const newUser = new userModel({
                        username: uniqueUsername,
                        email: address.email,
                        phoneNumber: address.phone,
                        password: hashedPassword,
                        profilePicture: '',
                        Address: `${address.street}, ${address.city}, ${address.state || address.city}`,
                        score: 0,
                        isVerified: true,
                        emailVerified: true
                    });
                    
                    console.log('💾 Creating user with data:', {
                        username: newUser.username,
                        email: newUser.email,
                        phoneNumber: newUser.phoneNumber
                    });
                    
                    try {
                        await newUser.save();
                        console.log('✅ User created successfully! ID:', newUser._id);
                        validUserId = newUser._id;
                        isNewUser = true;
                        
                        // Generate token for auto-login
                        const jwt = require('jsonwebtoken');
                        userToken = jwt.sign(
                            { id: newUser._id },
                            process.env.JWT_SECRET || 'your-secret-key-change-this',
                            { expiresIn: '30d' }
                        );
                    } catch (saveError) {
                        // If duplicate key error, try to find the existing user
                        if (saveError.code === 11000) {
                            console.log('⚠️ Duplicate key detected, fetching existing user...');
                            const existingUserByEmail = await userModel.findOne({ 
                                $or: [
                                    { email: address.email },
                                    { phoneNumber: address.phone }
                                ]
                            });
                            if (existingUserByEmail) {
                                console.log('✓ Found existing user after duplicate error:', existingUserByEmail._id);
                                validUserId = existingUserByEmail._id;
                                // Generate token for existing user
                                const jwt = require('jsonwebtoken');
                                userToken = jwt.sign(
                                    { id: existingUserByEmail._id },
                                    process.env.JWT_SECRET || 'your-secret-key-change-this',
                                    { expiresIn: '30d' }
                                );
                            } else {
                                console.error('❌ Could not find user after duplicate error');
                                throw saveError;
                            }
                        } else {
                            console.error('❌ Error saving user to database:', saveError);
                            throw saveError;
                        }
                    }
                } else {
                    console.log('✓ User exists in database:', userId);
                    validUserId = userId;
                }
            }

            // Process collection items - convert them to actual products
            const processedItems = [];
            const originalItemsMap = {}; // Map to preserve original cart data
            
            console.log(`\n🔍 === PROCESSING ${items.length} CART ITEMS ===`);
            for (const item of items) {
                console.log(`\n📦 Item: ${item.name || item.productName}`);
                console.log(`   - Type: ${item.type}`);
                console.log(`   - ProductId: ${item.productId}`);
                console.log(`   - Quantity: ${item.quantity}`);
                
                // Store original cart item for reference
                const itemKey = `${item.productId}_${item.type}`;
                originalItemsMap[itemKey] = {
                    price: item.price,
                    quantity: item.quantity,
                    name: item.name,
                    type: item.type
                };
                
                if (item.type === 'collection') {
                    try {
                        console.log(`🎴 Processing collection: ${item.name || item.productId}`);
                        const collectionProducts = await processCollectionItems(validUserId, item);
                        processedItems.push(...collectionProducts);
                        console.log(`✓ Collection expanded to ${collectionProducts.length} products`);
                        console.log(`   Products:`, collectionProducts.map(p => ({
                            name: p.productName,
                            image: p.image ? 'yes' : 'no',
                            collectionImage: p.collectionImage ? 'yes' : 'no'
                        })));
                    } catch (collectionError) {
                        console.error(`❌ Failed to process collection:`, collectionError.message);
                        console.error(`   Stack:`, collectionError.stack);
                        // Fallback: Add collection as-is if processing fails
                        processedItems.push({
                            itemType: 'collection',
                            productId: item.productId,
                            productName: item.name || 'Collection',
                            phoneModel: item.selectedModel || item.selectedBrand || 'Universal',
                            selectedBrand: item.selectedBrand,
                            selectedModel: item.selectedModel,
                            quantity: item.quantity,
                            price: item.price
                        });
                    }
                } else {
                    // Regular product, custom-design, or suggested product
                    console.log(`📦 Processing regular item: ${item.name}`);
                    const orderItem = {
                        itemType: item.type || 'product',
                        productId: item.productId,
                        productName: item.productDetails?.name || item.name || (item.type === 'custom-design' ? 'Custom Design' : 'Product'),
                        phoneModel: item.selectedModel || item.selectedBrand || 'Universal',
                        selectedBrand: item.selectedBrand,
                        selectedModel: item.selectedModel,
                        quantity: item.quantity,
                        price: item.price
                    };
                    
                    // Add image for products and suggested products
                    if (item.productDetails?.images?.[0]) {
                        orderItem.image = item.productDetails.images[0];
                        console.log(`   ✓ Added image from productDetails.images`);
                    } else if (item.productDetails?.image) {
                        orderItem.image = item.productDetails.image;
                        console.log(`   ✓ Added image from productDetails.image`);
                    } else if (item.image) {
                        orderItem.image = item.image;
                        console.log(`   ✓ Added image from item.image`);
                    }
                    
                    // Only add customDesign for custom-design items
                    if (item.type === 'custom-design' && item.customDesign) {
                        orderItem.customDesign = item.customDesign;
                        console.log(`   ✓ Added customDesign data`);
                    }
                    
                    processedItems.push(orderItem);
                    console.log(`   ✓ Added to processedItems`);
                }
            }

            console.log(`✓ Processed items: ${items.length} cart items → ${processedItems.length} order items`);

            // Calculate totals using ORIGINAL cart prices (not processed/divided prices)
            const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const shippingCost = deliveryCharge;
            
            // Calculate total discount from all applied coupons
            let totalDiscount = 0;
            if (appliedCoupons.length > 0) {
                totalDiscount = appliedCoupons.reduce((sum, c) => sum + (c.discountAmount || 0), 0);
                console.log(`🎟️ Applied ${appliedCoupons.length} coupons with total discount: ₹${totalDiscount}`);
                
                // Increment usage count for all coupons
                for (const c of appliedCoupons) {
                    try {
                        await couponModel.findOneAndUpdate(
                            { code: c.code }, 
                            { $inc: { usedCount: 1 } }
                        );
                        console.log(`✅ Incremented usage for coupon: ${c.code}`);
                    } catch (error) {
                        console.error(`⚠️ Failed to increment coupon ${c.code}:`, error.message);
                    }
                }
            }

            const totalAmount = subtotal + shippingCost - totalDiscount;

            // Generate unique order ID
            const orderIdStr = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const orderNumber = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

            // Format items for the schema - use PROCESSED items (individual gaming cards with images)
            // This ensures gaming collection products show as individual cards with their details
            const formattedItems = processedItems.map(item => {
                let productObjectId;
                
                if (mongoose.Types.ObjectId.isValid(item.productId)) {
                    productObjectId = item.productId;
                } else {
                    console.log(`⚠️ Invalid productId format: ${item.productId}, creating placeholder`);
                    productObjectId = new mongoose.Types.ObjectId();
                }
                
                const formattedItem = {
                    itemType: item.itemType || 'product',
                    productId: productObjectId,
                    productName: item.productName,
                    phoneModel: item.phoneModel,
                    selectedBrand: item.selectedBrand,
                    selectedModel: item.selectedModel,
                    quantity: item.quantity,
                    price: item.price
                };
                
                // Add optional fields if they exist
                if (item.collectionId) formattedItem.collectionId = item.collectionId;
                if (item.collectionName) formattedItem.collectionName = item.collectionName;
                if (item.collectionImage) formattedItem.collectionImage = item.collectionImage;
                if (item.image) formattedItem.image = item.image;
                if (item.customDesign) formattedItem.customDesign = item.customDesign;
                
                return formattedItem;
            });
            
            console.log(`✓ Formatted ${formattedItems.length} items for order with images:`, 
                formattedItems.map(i => ({ name: i.productName, hasImage: !!i.image, hasCollectionImage: !!i.collectionImage })));

            // Format shipping address
            const shippingAddress = {
                fullName: `${address.firstName} ${address.lastName}`,
                phoneNumber: address.phone,
                email: address.email,
                addressLine1: address.street,
                addressLine2: '',
                city: address.city,
                state: address.state || address.city,
                zipCode: address.zipcode,
                country: address.country || 'India'
            };

            // Create order in database
            const newOrder = new orderModel({
                orderId: orderIdStr,
                orderNumber: orderNumber,
                userId: validUserId,
                items: formattedItems,
                subtotal: subtotal,
                discount: totalDiscount,
                shippingCost: shippingCost,
                totalAmount: totalAmount,
                status: 'Confirmed',
                paymentMethod: 'Razorpay',
                paymentStatus: 'Paid',
                isPaid: true,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                shippingAddress: shippingAddress,
                appliedCoupons: appliedCoupons,
                // Legacy fields for backward compatibility
                couponCode: appliedCoupons.length > 0 ? appliedCoupons[0].code : null,
                couponDiscount: totalDiscount
            });

            console.log('🎟️ Order appliedCoupons before save:', newOrder.appliedCoupons);
            console.log('🎨 Order items with customDesign:', newOrder.items.filter(i => i.customDesign).map(i => ({
                productName: i.productName,
                hasCustomDesign: !!i.customDesign,
                designImageUrl: i.customDesign?.designImageUrl,
                originalImageUrl: i.customDesign?.originalImageUrl
            })));
            
            await newOrder.save();
            console.log('✅ Order saved successfully with ID:', newOrder._id);
            console.log('📋 Order status: Confirmed (Shipment not created yet - waiting for manual confirmation)');

            // Add ordered products to user's unlocked collection
            try {
                console.log('🔍 Processed items for unlocking:', JSON.stringify(processedItems.map(item => ({
                    itemType: item.itemType,
                    productId: item.productId,
                    collectionId: item.collectionId
                })), null, 2));
                
                const productIdsToUnlock = processedItems
                    .filter(item => item.itemType === 'product' && item.productId)
                    .map(item => item.productId);

                const collectionIdsToUnlock = processedItems
                    .filter(item => item.collectionId)
                    .map(item => item.collectionId)
                    .filter((value, index, self) => {
                        const strValue = value.toString();
                        return self.findIndex(v => v.toString() === strValue) === index;
                    }); // Unique collections

                console.log('🔓 Products to unlock:', productIdsToUnlock);
                console.log('🔓 Collections to unlock:', collectionIdsToUnlock);

                // Legacy unlocking (keep for backward compatibility)
                if (productIdsToUnlock.length > 0) {
                    const updateResult = await userModel.findByIdAndUpdate(validUserId, {
                        $addToSet: { 
                            unlockedProducts: { $each: productIdsToUnlock }
                        }
                    }, { new: true });
                    console.log(`🔓 Unlocked ${productIdsToUnlock.length} products for user. Total products now: ${updateResult.unlockedProducts?.length || 0}`);
                }

                if (collectionIdsToUnlock.length > 0) {
                    const updateResult = await userModel.findByIdAndUpdate(validUserId, {
                        $addToSet: { 
                            unlockedCollections: { $each: collectionIdsToUnlock }
                        }
                    }, { new: true });
                    console.log(`🔓 Unlocked ${collectionIdsToUnlock.length} collections for user. Total collections now: ${updateResult.unlockedCollections?.length || 0}`);
                }

                // NEW: Organize products into gaming collections and standard products
                const collectionModel = require('../../Models/Collection/Collection.model');
                const productModel = require('../../Models/Products/Product.model');
                
                // Group items by collection
                const collectionGroups = {};
                const standardProducts = [];
                
                console.log('📦 Processing items for gaming collections...');
                console.log('Total processed items:', processedItems.length);
                
                for (const item of processedItems) {
                    console.log('Processing item:', {
                        itemType: item.itemType,
                        productId: item.productId,
                        productName: item.productName,
                        collectionId: item.collectionId,
                        collectionName: item.collectionName
                    });
                    
                    if (item.collectionId) {
                        // This is a gaming collection product
                        const collId = item.collectionId.toString();
                        
                        if (!collectionGroups[collId]) {
                            // Fetch collection details once per collection
                            const collection = await collectionModel.findById(collId);
                            if (collection) {
                                collectionGroups[collId] = {
                                    collectionId: collId,
                                    collectionName: collection.name,
                                    collectionImage: collection.heroImage || '',
                                    cards: []
                                };
                                console.log(`✅ Created collection group for: ${collection.name}`);
                            } else {
                                console.error(`❌ Collection not found: ${collId}`);
                                continue;
                            }
                        }
                        
                        // Fetch product details and add to cards
                        if (item.productId) {
                            const product = await productModel.findById(item.productId);
                            if (product) {
                                // Check if this card is already in the array
                                const cardExists = collectionGroups[collId].cards.some(
                                    card => card.productId.toString() === item.productId.toString()
                                );
                                
                                if (!cardExists) {
                                    const imageUrl = product.image || product.images?.[0] || '';
                                    collectionGroups[collId].cards.push({
                                        productId: item.productId,
                                        name: product.name,
                                        image: imageUrl
                                    });
                                    console.log(`  ✅ Added card: ${product.name} (${imageUrl.substring(0, 50)}...)`);
                                } else {
                                    console.log(`  ⚠️ Card already exists: ${product.name}`);
                                }
                            } else {
                                console.error(`  ❌ Product not found: ${item.productId}`);
                            }
                        }
                    } else if (item.productId && item.itemType !== 'custom-design') {
                        // Standard product (not part of gaming collection)
                        const product = await productModel.findById(item.productId);
                        if (product) {
                            const imageUrl = product.image || product.images?.[0] || '';
                            standardProducts.push({
                                productId: item.productId,
                                name: product.name,
                                image: imageUrl
                            });
                            console.log(`✅ Added standard product: ${product.name} (${imageUrl.substring(0, 50)}...)`);
                        }
                    }
                }
                
                console.log('🎮 Gaming collections to add:', Object.keys(collectionGroups).length);
                Object.keys(collectionGroups).forEach(collId => {
                    const coll = collectionGroups[collId];
                    console.log(`  - ${coll.collectionName}: ${coll.cards.length} cards`);
                });
                console.log('🃏 Standard products to add:', standardProducts.length);
                
                // Update user with new gaming collections
                for (const collId in collectionGroups) {
                    const collectionData = collectionGroups[collId];
                    
                    // Check if collection already exists for user
                    const user = await userModel.findById(validUserId);
                    const existingCollection = user.gamingCollections?.find(
                        gc => gc.collectionId.toString() === collId
                    );
                    
                    if (existingCollection) {
                        // Add new cards to existing collection (avoid duplicates)
                        const newCards = collectionData.cards.filter(card => 
                            !existingCollection.cards.some(
                                existingCard => existingCard.productId.toString() === card.productId.toString()
                            )
                        );
                        
                        if (newCards.length > 0) {
                            await userModel.findOneAndUpdate(
                                { 
                                    _id: validUserId,
                                    'gamingCollections.collectionId': collId
                                },
                                {
                                    $push: {
                                        'gamingCollections.$.cards': { $each: newCards }
                                    }
                                }
                            );
                            console.log(`✅ Added ${newCards.length} new cards to existing collection: ${collectionData.collectionName}`);
                        }
                    } else {
                        // Add new collection
                        await userModel.findByIdAndUpdate(validUserId, {
                            $push: {
                                gamingCollections: collectionData
                            }
                        });
                        console.log(`✅ Added new gaming collection: ${collectionData.collectionName} with ${collectionData.cards.length} cards`);
                    }
                }
                
                // Update user with standard products (avoid duplicates)
                if (standardProducts.length > 0) {
                    const user = await userModel.findById(validUserId);
                    const newStandardProducts = standardProducts.filter(product =>
                        !user.standardProducts?.some(
                            sp => sp.productId.toString() === product.productId.toString()
                        )
                    );
                    
                    if (newStandardProducts.length > 0) {
                        await userModel.findByIdAndUpdate(validUserId, {
                            $push: {
                                standardProducts: { $each: newStandardProducts }
                            }
                        });
                        console.log(`✅ Added ${newStandardProducts.length} new standard products`);
                    }
                }
                
                // Calculate and update user score based on gaming card levels
                try {
                    const user = await userModel.findById(validUserId).populate('gamingCollections.cards.productId');
                    let totalScore = 0;
                    
                    for (const collection of user.gamingCollections || []) {
                        for (const card of collection.cards || []) {
                            if (card.productId && card.productId.level) {
                                const level = parseInt(card.productId.level) || 0;
                                totalScore += level;
                            }
                        }
                    }
                    
                    await userModel.findByIdAndUpdate(validUserId, {
                        $set: { score: totalScore }
                    });
                    
                    console.log(`🏆 Updated user score to ${totalScore} (sum of all card levels)`);
                } catch (scoreErr) {
                    console.error('⚠️ Could not update user score:', scoreErr.message);
                }
                
            } catch (err) {
                console.error('⚠️ Could not unlock products:', err.message);
                console.error('⚠️ Error stack:', err.stack);
            }

            // Clear user's cart from Cart collection (including items and applied coupons)
            try {
                await cartModel.findOneAndUpdate(
                    { userId: validUserId },
                    { $set: { items: [], appliedCoupons: [] } }
                );
                console.log('🛒 Cart and coupons cleared for user');
            } catch (err) {
                console.log('⚠️ Could not clear cart:', err.message);
            }

            res.json({ 
                success: true, 
                message: "Payment successful! Order placed.",
                orderId: newOrder._id,
                orderNumber: orderNumber,
                userId: validUserId.toString(),
                token: userToken,
                isNewUser: isNewUser
            });
        } else {
            console.log('❌ Payment not completed. Status:', orderInfo.status);
            res.json({ success: false, message: 'Payment not completed' });
        }
    } catch (error) {
        console.error('❌ Razorpay verification error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Payment verification failed',
            error: error.message 
        });
    }
}

const allOrders = async (req,res) => {
    try {
        // Populate product/collection data as fallback for orders without direct image fields
        const orders = await orderModel.find({ isPaid: true })
            .populate({
                path: 'items.productId',
                select: 'name images image type'
            })
            .populate({
                path: 'items.collectionId',
                select: 'name type heroImage'
            })
            .sort({ createdAt: -1 });
        res.json({success:true,orders:orders})
    } catch (error) {
        console.error('Fetch all orders error:', error);
        res.status(500).json({success:false,message:'Internal server error'})
    }
}

const userOrders = async (req, res) => {
    try {
        console.log('📋 Fetching user orders for:', req.body.userId);
        
        const mongoose = require('mongoose');
        let userId = req.body.userId;
        let { email } = req.body; // Also accept email for guest users
        
        // Handle guest users - try to find orders by email
        if (!userId || userId.startsWith('guest_')) {
            console.log('⚠️ Guest userId detected, trying to find orders by email...');
            
            if (email) {
                // Find all orders where shipping address email matches
                // Populate collectionId to get collection details
                const orders = await orderModel.find({ 
                    'shippingAddress.email': email 
                })
                .populate({
                    path: 'items.collectionId',
                    select: 'name type heroImage Products',
                    populate: {
                        path: 'Products',
                        select: 'name images'
                    }
                })
                .populate('items.productId', 'name images')
                .sort({ createdAt: -1 });
                
                console.log(`✓ Found ${orders.length} orders for email: ${email}`);
                return res.json({ success: true, orders: orders });
            }
            
            return res.json({ 
                success: true, 
                orders: [],
                message: 'Please provide email to view orders' 
            });
        }
        
        // Validate if userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.log('⚠️ Invalid userId format, trying email lookup...');
            
            if (email) {
                const orders = await orderModel.find({ 
                    'shippingAddress.email': email 
                })
                .populate({
                    path: 'items.collectionId',
                    select: 'name type heroImage Products',
                    populate: {
                        path: 'Products',
                        select: 'name images'
                    }
                })
                .populate('items.productId', 'name images')
                .sort({ createdAt: -1 });
                
                console.log(`✓ Found ${orders.length} orders for email: ${email}`);
                return res.json({ success: true, orders: orders });
            }
            
            return res.json({ 
                success: true, 
                orders: [],
                message: 'Invalid user ID format' 
            });
        }
        
        // Fetch all orders for the user (including COD orders with isPaid: false)
        // Populate collectionId to get collection details with products
        const orders = await orderModel.find({ userId: userId })
            .populate({
                path: 'items.collectionId',
                select: 'name type heroImage Products',
                populate: {
                    path: 'Products',
                    select: 'name images'
                }
            })
            .populate('items.productId', 'name images')
            .sort({ createdAt: -1 });
        console.log(`✓ Found ${orders.length} orders for user`);
        res.json({ success: true, orders: orders });
    } catch (error) {
        console.error('Fetch user orders error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }

        const order = await orderModel.findById(orderId)
            .populate('userId', 'name email')
            .populate('items.productId', 'name image images price')
            .populate('items.collectionId', 'name type heroImage');

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.json({ success: true, order });
    } catch (error) {
        console.error('Get order error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid order ID format" });
        }
        res.status(500).json({ success: false, message: 'Failed to fetch order' });
    }
};

const updateStatus = async (req,res) => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: "Order ID and status are required" });
        }

        // Must match the enum values in Order.model.js
        const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded', 'Failed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status. Valid values: " + validStatuses.join(', ') });
        }

        const order = await orderModel.findByIdAndUpdate(orderId, { status }, { new: true });
        
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.json({ success: true, message: 'Status Updated', order });
    } catch (error) {
        console.error('Update status error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid order ID" });
        }
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
}

const updateTracking = async (req, res) => {
    try {
        const { orderId, trackingLink, trackingNumber, courierPartner } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }

        const updateData = {};
        if (trackingLink !== undefined) updateData.trackingLink = trackingLink;
        if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
        if (courierPartner !== undefined) updateData.courierPartner = courierPartner;

        const order = await orderModel.findByIdAndUpdate(orderId, updateData, { new: true });
        
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.json({ success: true, message: 'Tracking information updated', order });
    } catch (error) {
        console.error('Update tracking error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid order ID" });
        }
        res.status(500).json({ success: false, message: 'Failed to update tracking information' });
    }
}

const deleteOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: "Only delivered orders can be deleted" });
        }
        await orderModel.findByIdAndDelete(orderId);
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Delete order error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid order ID" });
        }
        res.status(500).json({ success: false, message: 'Failed to delete order' });
    }
}

// Placing orders using COD Method
const placeOrderCOD = async (req, res) => {
    try {
        console.log('📦 Creating COD Order - Request body:', req.body);
        
        const { items, amount, address, coupon, userId } = req.body;

        const validationErrors = validateOrderData({ items, amount, address });
        if (validationErrors.length > 0) {
            console.error('❌ Validation errors:', validationErrors);
            return res.status(400).json({ success: false, message: validationErrors.join(', ') });
        }

        const mongoose = require('mongoose');
        let validUserId;
        
        // Handle guest users
        if (!userId || userId === 'guest' || userId.startsWith('guest_')) {
            console.log('⚠️ Guest user detected for COD order...');
            
            let guestUser = await userModel.findOne({ 
                $or: [
                    { email: address.email },
                    { phoneNumber: address.phone }
                ]
            });
            
            if (!guestUser) {
                const baseUsername = address.email.split('@')[0];
                const timestamp = Date.now();
                const uniqueUsername = `${baseUsername}_${timestamp}`;
                
                guestUser = new userModel({
                    username: uniqueUsername,
                    email: address.email,
                    phoneNumber: address.phone,
                    profilePicture: '',
                    Address: `${address.street}, ${address.city}, ${address.state || address.city}`,
                    score: 0
                });
                await guestUser.save();
                console.log('✓ Guest user created:', guestUser._id);
            } else {
                console.log('✓ Existing user found:', guestUser._id);
            }
            
            validUserId = guestUser._id;
        } else if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.error('❌ Invalid userId format:', userId);
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        } else {
            validUserId = userId;
        }

        let discount = 0;
        let couponDiscountPercentage = 0;

        // If coupon was provided, use it and increment usage
        if (coupon) {
            try {
                console.log('🎟️ Using coupon for COD:', coupon);
                const couponResult = await useCoupon(coupon);
                if (couponResult.success) {
                    couponDiscountPercentage = couponResult.discountPercentage;
                    const subtotalForCoupon = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    discount = Math.round((subtotalForCoupon * couponDiscountPercentage) / 100);
                    console.log(`✅ Coupon applied! ${couponDiscountPercentage}% discount = ₹${discount}`);
                }
            } catch (error) {
                console.error('⚠️ Coupon usage failed:', error.message);
                // Continue without coupon if it fails
            }
        }

        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = deliveryCharge;
        const totalAmount = subtotal + shippingCost - discount;

        // Generate unique order ID
        const orderIdStr = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const orderNumber = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

        // Format items for the schema
        const formattedItems = items.map(item => {
            let productObjectId;
            
            if (mongoose.Types.ObjectId.isValid(item.productId)) {
                productObjectId = item.productId;
            } else {
                console.log(`⚠️ Invalid productId format: ${item.productId}, creating placeholder`);
                productObjectId = new mongoose.Types.ObjectId();
            }
            
            return {
                productId: productObjectId,
                productName: item.name,
                phoneModel: item.selectedModel || item.selectedBrand || 'Universal',
                quantity: item.quantity,
                price: item.price
            };
        });

        // Format shipping address
        const shippingAddress = {
            fullName: `${address.firstName} ${address.lastName}`,
            phoneNumber: address.phone,
            email: address.email,
            addressLine1: address.street,
            addressLine2: '',
            city: address.city,
            state: address.state || address.city,
            zipCode: address.zipcode,
            country: address.country || 'India'
        };
        
        const newOrder = new orderModel({
            orderId: orderIdStr,
            orderNumber: orderNumber,
            userId: validUserId,
            items: formattedItems,
            subtotal: subtotal,
            discount: discount,
            shippingCost: shippingCost,
            totalAmount: totalAmount,
            status: 'Confirmed', // Valid enum: Pending, Confirmed, Processing, Shipped, Out for Delivery, Delivered, Cancelled, Refunded, Failed
            paymentMethod: 'COD',
            paymentStatus: 'Pending', // COD is paid on delivery
            isPaid: false,
            shippingAddress: shippingAddress,
            couponCode: coupon || null,
            couponDiscount: discount
        });
        
        console.log('💾 Saving COD order to database...');
        await newOrder.save();
        console.log('✓ COD Order saved with ID:', newOrder._id);

        // Clear user's cart from Cart collection (including items and applied coupons)
        try {
            await cartModel.findOneAndUpdate(
                { userId: validUserId },
                { $set: { items: [], appliedCoupons: [] } }
            );
            console.log('🛒 Cart and coupons cleared for user');
        } catch (err) {
            console.log('⚠️ Could not clear cart:', err.message);
        }

        /* if (coupon) {
            await couponModel.findOneAndUpdate(
                { code: coupon.toUpperCase() },
                { $inc: { usageCount: 1 } }
            );
        } */

        console.log('✅ COD Order placed successfully!');
        res.json({ success: true, message: "Order placed successfully", orderId: newOrder._id, orderNumber: orderNumber });
    } catch (error) {
        console.error('❌ COD order error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ success: false, message: 'Order placement failed', error: error.message });
    }
}

// Get leaderboard with points calculation
const getLeaderboard = async (req, res) => {
    try {
        console.log('📊 Fetching leaderboard data...');

        // Aggregate orders to calculate points per user
        const leaderboardData = await orderModel.aggregate([
            {
                // Only include completed/delivered orders
                $match: {
                    status: { $in: ['Delivered', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery'] }
                }
            },
            {
                // Unwind items array to process each item
                $unwind: '$items'
            },
            {
                // Group by userId and calculate points
                $group: {
                    _id: '$userId',
                    totalOrders: { $sum: 1 },
                    collectionsCount: {
                        $sum: {
                            $cond: [
                                { $ifNull: ['$items.collectionId', false] }, 
                                1, 
                                0
                            ]
                        }
                    },
                    standardCardsCount: {
                        $sum: {
                            $cond: [
                                { $ifNull: ['$items.collectionId', false] }, 
                                0, 
                                1
                            ]
                        }
                    }
                }
            },
            {
                // Calculate total points: collections = 2 points, standard cards = 1 point
                $addFields: {
                    totalPoints: {
                        $add: [
                            { $multiply: ['$collectionsCount', 2] },
                            { $multiply: ['$standardCardsCount', 1] }
                        ]
                    }
                }
            },
            {
                // Sort by total points descending
                $sort: { totalPoints: -1 }
            }
        ]);

        console.log(`Found ${leaderboardData.length} users in leaderboard`);
        console.log('Leaderboard data:', JSON.stringify(leaderboardData, null, 2));

        // Fetch user details for each entry
        const leaderboard = await Promise.all(
            leaderboardData.map(async (entry, index) => {
                console.log(`Fetching user details for userId: ${entry._id}`);
                const user = await userModel.findById(entry._id).select('username email phoneNumber');
                console.log(`User found:`, user);
                return {
                    rank: index + 1,
                    userId: entry._id,
                    userName: user?.username || 'Unknown User',
                    email: user?.email || 'N/A',
                    phone: user?.phoneNumber || 'N/A',
                    totalPoints: entry.totalPoints,
                    collectionsCount: entry.collectionsCount,
                    standardCardsCount: entry.standardCardsCount,
                    totalOrders: entry.totalOrders
                };
            })
        );

        console.log('Final leaderboard:', JSON.stringify(leaderboard, null, 2));

        console.log('✅ Leaderboard generated successfully');
        res.json({
            success: true,
            leaderboard,
            message: 'Leaderboard fetched successfully'
        });

    } catch (error) {
        console.error('❌ Leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard',
            error: error.message
        });
    }
};

/**
 * Manually create shipment in iThink Logistics for an order
 */
const createOrderShipment = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await orderModel.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.awbCode) {
            return res.status(400).json({ success: false, message: 'Shipment already created for this order' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Cannot create shipment for cancelled order' });
        }

        console.log('📦 Creating shipment in iThink Logistics for order:', orderId);

        // Prepare shipment data
        const shipmentResult = await createShipment({
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            items: order.items,
            shippingAddress: order.shippingAddress,
            totalAmount: order.totalAmount,
            subtotal: order.subtotal,
            shippingCost: order.shippingCost,
            discount: order.discount,
            paymentMethod: order.paymentMethod
        });

        if (shipmentResult.success) {
            // Update order with shipment details
            order.awbCode = shipmentResult.awbCode;
            order.shipmentId = shipmentResult.shipmentId;
            order.trackingNumber = shipmentResult.awbCode;
            order.courierPartner = shipmentResult.courierName;
            order.status = 'Processing';
            await order.save();

            console.log('✅ Shipment created! AWB:', shipmentResult.awbCode);

            return res.status(200).json({
                success: true,
                message: 'Shipment created successfully',
                data: {
                    orderId: order._id,
                    awbCode: shipmentResult.awbCode,
                    shipmentId: shipmentResult.shipmentId,
                    courierName: shipmentResult.courierName,
                    trackingNumber: shipmentResult.awbCode
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Failed to create shipment',
                error: shipmentResult.message
            });
        }
    } catch (error) {
        console.error('❌ Error creating shipment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create shipment',
            error: error.message
        });
    }
};

/**
 * Cancel shipment in iThink Logistics
 */
const cancelOrderShipment = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await orderModel.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!order.awbCode) {
            return res.status(400).json({ success: false, message: 'No shipment to cancel' });
        }

        console.log('🚫 Cancelling shipment for order:', orderId, 'AWB:', order.awbCode);

        // Cancel shipment in iThink Logistics
        const { cancelShipment: cancelShipmentAPI } = require('../utils/iThinkLogistics');
        const cancelResult = await cancelShipmentAPI(order.awbCode);

        if (cancelResult.success) {
            // Clear shipment details but keep order
            order.awbCode = null;
            order.shipmentId = null;
            order.trackingNumber = null;
            order.courierPartner = null;
            order.status = 'Confirmed'; // Back to confirmed
            await order.save();

            console.log('✅ Shipment cancelled successfully');

            return res.status(200).json({
                success: true,
                message: 'Shipment cancelled successfully. Order is back to Confirmed status.',
                data: order
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Failed to cancel shipment',
                error: cancelResult.message
            });
        }
    } catch (error) {
        console.error('❌ Error cancelling shipment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel shipment',
            error: error.message
        });
    }
};

/**
 * Cancel entire order (with optional shipment cancellation)
 */
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const order = await orderModel.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'Delivered') {
            return res.status(400).json({ success: false, message: 'Cannot cancel delivered order' });
        }

        console.log('🚫 Cancelling order:', orderId);

        // If shipment exists, cancel it first
        if (order.awbCode) {
            try {
                const { cancelShipment: cancelShipmentAPI } = require('../utils/iThinkLogistics');
                await cancelShipmentAPI(order.awbCode);
                console.log('✅ Shipment cancelled in iThink Logistics');
            } catch (shipmentError) {
                console.warn('⚠️ Could not cancel shipment:', shipmentError.message);
            }
        }

        order.status = 'Cancelled';
        order.cancellationReason = reason || 'Cancelled by admin';
        order.cancelledAt = new Date();
        order.cancelledBy = 'Admin';
        await order.save();

        console.log('✅ Order cancelled successfully');

        return res.status(200).json({
            success: true,
            message: 'Order cancelled successfully',
            data: order
        });
    } catch (error) {
        console.error('❌ Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order',
            error: error.message
        });
    }
};

module.exports = {
    verifyRazorpay,
    placeOrderRazorpay, 
    // createRazorpayOrder, // DEPRECATED - Don't export (orders created after payment now)
    placeOrderCOD,
    allOrders,
    getOrderById,
    userOrders, 
    updateStatus,
    updateTracking,
    deleteOrder,
    getLeaderboard,
    createOrderShipment,
    cancelOrderShipment,
    cancelOrder
};