const orderModel = require("../../Models/Order/Order.model.js");
const userModel = require("../../Models/User/User.model.js");
const cartModel = require("../../Models/Cart/Cart.model.js");
const couponModel = require("../../Models/Coupon/Coupon.model.js");
const productModel = require("../../Models/Products/Product.model.js");
const collectionModel = require("../../Models/Collection/Collection.model.js");
const { useCoupon } = require("./coupon.controller.js");
const Razorpay = require('razorpay');
const validator = require("validator");
require('dotenv').config();

// global variables
const currency = 'inr'
const deliveryCharge = 0

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
            phoneModel: selectedModel,
            selectedBrand,
            selectedModel,
            quantity: 1,
            price: price / quantity, // Divide price evenly
            image: product.image
        }));

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
                // Regular product or custom-design
                processedItems.push({
                    itemType: item.type || 'product',
                    productId: item.productId,
                    productName: item.name,
                    phoneModel: item.selectedModel || item.selectedBrand || 'Universal',
                    selectedBrand: item.selectedBrand,
                    selectedModel: item.selectedModel,
                    quantity: item.quantity,
                    price: item.price,
                    customDesign: item.customDesign || undefined
                });
            }
        }

        console.log(`✓ Processed items: ${items.length} cart items → ${processedItems.length} order items`);

        // Calculate totals
        const subtotal = processedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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

        // Format items for the schema - convert string IDs to ObjectIds if possible
        const formattedItems = processedItems.map(item => {
            let productObjectId;
            
            // Try to convert productId to ObjectId, if it fails, create a new ObjectId
            if (mongoose.Types.ObjectId.isValid(item.productId)) {
                productObjectId = item.productId;
            } else {
                // For non-ObjectId product IDs, we need to either:
                // 1. Look up the product in the database, or
                // 2. Create a placeholder ObjectId
                console.log(`⚠️ Invalid productId format: ${item.productId}, creating placeholder`);
                productObjectId = new mongoose.Types.ObjectId();
            }
            
            return {
                itemType: item.itemType || 'product',
                productId: productObjectId,
                productName: item.productName || item.name || 'Product',
                collectionId: item.collectionId || undefined,
                phoneModel: item.phoneModel || item.selectedModel || item.selectedBrand || 'Universal',
                quantity: item.quantity,
                price: item.price,
                customDesign: item.customDesign || undefined
            };
        });

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

        let discount = 0;
        if (coupon) {
            const couponData = await couponModel.findOne({code:coupon});
            if (couponData) {
                const subtotal = calculateOrderTotal(items);
                const percent = couponData.discountPercentage || couponData.discount || 0;
                discount = (subtotal * percent) / 100;
            }
        }

        const totalAmount = calculateOrderTotal(items, deliveryCharge, discount);

        // Defensive: prevent NaN
        if (isNaN(totalAmount)) {
            return res.status(400).json({ success: false, message: "Order total calculation failed" });
        }

        if (totalAmount < 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        const options = {
            amount: Math.round(totalAmount * 100),
            currency: currency.toUpperCase(),
            receipt: Date.now().toString()
        };

        const order = await razorpayInstance.orders.create(options);
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

            // Normalize coupon value - handle empty arrays, empty strings, null, undefined
            const coupon = (Array.isArray(rawCoupon) && rawCoupon.length === 0) || !rawCoupon || rawCoupon === '' 
                ? null 
                : (Array.isArray(rawCoupon) ? rawCoupon[0] : rawCoupon);

            const mongoose = require('mongoose');
            let validUserId;
            
            // Handle guest users
            if (!userId || userId === 'guest' || userId.startsWith('guest_')) {
                console.log('⚠️ Guest user detected, finding/creating user...');
                
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
                    // Regular product or custom-design
                    processedItems.push({
                        itemType: item.type || 'product',
                        productId: item.productId,
                        productName: item.name,
                        phoneModel: item.selectedModel || item.selectedBrand || 'Universal',
                        selectedBrand: item.selectedBrand,
                        selectedModel: item.selectedModel,
                        quantity: item.quantity,
                        price: item.price,
                        customDesign: item.customDesign || undefined
                    });
                }
            }

            console.log(`✓ Processed items: ${items.length} cart items → ${processedItems.length} order items`);

            // Calculate totals
            const subtotal = processedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const shippingCost = deliveryCharge;
            let discount = 0;
            let couponDiscountPercentage = 0;

            // If coupon was provided, use it and increment usage
            if (coupon) {
                try {
                    console.log('🎟️ Using coupon:', coupon);
                    const couponResult = await useCoupon(coupon);
                    if (couponResult.success) {
                        couponDiscountPercentage = couponResult.discountPercentage;
                        discount = Math.round((subtotal * couponDiscountPercentage) / 100);
                        console.log(`✅ Coupon applied! ${couponDiscountPercentage}% discount = ₹${discount}`);
                    }
                } catch (error) {
                    console.error('⚠️ Coupon usage failed:', error.message);
                    // Continue without coupon if it fails
                }
            }

            const totalAmount = subtotal + shippingCost - discount;

            // Generate unique order ID
            const orderIdStr = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const orderNumber = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

            // Format items for the schema
            const formattedItems = processedItems.map(item => {
                let productObjectId;
                
                if (mongoose.Types.ObjectId.isValid(item.productId)) {
                    productObjectId = item.productId;
                } else {
                    console.log(`⚠️ Invalid productId format: ${item.productId}, creating placeholder`);
                    productObjectId = new mongoose.Types.ObjectId();
                }
                
                return {
                    itemType: item.itemType || 'product',
                    productId: productObjectId,
                    productName: item.productName || item.name || 'Product',
                    collectionId: item.collectionId || undefined,
                    phoneModel: item.phoneModel || item.selectedModel || item.selectedBrand || 'Universal',
                    quantity: item.quantity,
                    price: item.price,
                    customDesign: item.customDesign || undefined
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

            // Create order in database
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
                paymentMethod: 'Razorpay',
                paymentStatus: 'Paid',
                isPaid: true,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                shippingAddress: shippingAddress,
                couponCode: coupon || null,
                couponDiscount: discount
            });

            await newOrder.save();
            console.log('✅ Order saved successfully with ID:', newOrder._id);

            // Add ordered products to user's unlocked collection
            try {
                const productIdsToUnlock = formattedItems
                    .filter(item => item.itemType === 'product' && item.productId)
                    .map(item => item.productId);

                const collectionIdsToUnlock = formattedItems
                    .filter(item => item.collectionId)
                    .map(item => item.collectionId)
                    .filter((value, index, self) => self.indexOf(value) === index); // Unique

                if (productIdsToUnlock.length > 0) {
                    await userModel.findByIdAndUpdate(validUserId, {
                        $addToSet: { 
                            unlockedProducts: { $each: productIdsToUnlock }
                        }
                    });
                    console.log(`🔓 Unlocked ${productIdsToUnlock.length} products for user`);
                }

                if (collectionIdsToUnlock.length > 0) {
                    await userModel.findByIdAndUpdate(validUserId, {
                        $addToSet: { 
                            unlockedCollections: { $each: collectionIdsToUnlock }
                        }
                    });
                    console.log(`🔓 Unlocked ${collectionIdsToUnlock.length} collections for user`);
                }
            } catch (err) {
                console.error('⚠️ Could not unlock products:', err.message);
            }

            // Clear user's cart from Cart collection
            try {
                await cartModel.findOneAndUpdate(
                    { userId: validUserId },
                    { $set: { items: [] } }
                );
                console.log('🛒 Cart cleared for user');
            } catch (err) {
                console.log('⚠️ Could not clear cart:', err.message);
            }

            res.json({ 
                success: true, 
                message: "Payment successful! Order placed.",
                orderId: newOrder._id,
                orderNumber: orderNumber
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
        const orders = await orderModel.find({ isPaid: true }).sort({ createdAt: -1 });
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
                const orders = await orderModel.find({ 
                    'shippingAddress.email': email 
                }).sort({ createdAt: -1 });
                
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
                }).sort({ createdAt: -1 });
                
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
        const orders = await orderModel.find({ userId: userId }).sort({ createdAt: -1 });
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
            .populate('items.productId', 'name image price')
            .populate('items.collectionId', 'name type');

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

        // Clear user's cart from Cart collection
        try {
            await cartModel.findOneAndUpdate(
                { userId: validUserId },
                { $set: { items: [] } }
            );
            console.log('🛒 Cart cleared for user');
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
    getLeaderboard
};