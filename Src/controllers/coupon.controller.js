const Coupon = require('../../Models/Coupon/Coupon.model');

// Add new coupon (Admin only)
const addCoupon = async (req, res) => {
    try {
        const { code, discountPercentage, minimumAmount, expiryDate, maxUsage, description } = req.body;

        // Validation
        if (!code || !discountPercentage || !minimumAmount || !expiryDate || !maxUsage) {
            return res.status(400).json({ 
                success: false, 
                message: 'All required fields must be provided' 
            });
        }

        // Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() } );
        if (existingCoupon) {
            return res.status(400).json({ 
                success: false, 
                message: 'Coupon code already exists' 
            });
        }

        const newCoupon = new Coupon({
            code: code.toUpperCase(),
            discountPercentage: Number(discountPercentage),
            minimumAmount: Number(minimumAmount),
            expiryDate: new Date(expiryDate),
            maxUsage: Number(maxUsage),
            description
        });

        await newCoupon.save();

        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            coupon: newCoupon
        });
    } catch (error) {
        console.error('Add coupon error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create coupon',
            error: error.message 
        });
    }
};

// Get all coupons (Admin only)
const listCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        
        res.json({
            success: true,
            coupons
        });
    } catch (error) {
        console.error('List coupons error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch coupons' 
        });
    }
};

// Validate and apply coupon (User) - supports multiple coupons
const validateCoupon = async (req, res) => {
    try {
        const { code, orderAmount, appliedCoupons = [] } = req.body;

        if (!code || !orderAmount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Coupon code and order amount are required' 
            });
        }

        // Check if coupon is already applied
        const alreadyApplied = appliedCoupons.some(
            c => c.code.toUpperCase() === code.toUpperCase()
        );
        
        if (alreadyApplied) {
            return res.status(400).json({ 
                success: false, 
                message: 'This coupon is already applied' 
            });
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon) {
            return res.status(404).json({ 
                success: false, 
                message: 'Invalid coupon code' 
            });
        }

        // Check if coupon is valid
        if (!coupon.isValid()) {
            return res.status(400).json({ 
                success: false, 
                message: 'This coupon has expired or reached maximum usage limit' 
            });
        }

        // Check minimum order amount
        if (orderAmount < coupon.minimumAmount) {
            return res.status(400).json({ 
                success: false, 
                message: `Minimum order amount of ₹${coupon.minimumAmount} required to use this coupon` 
            });
        }

        // Calculate discount
        const discountAmount = Math.round((orderAmount * coupon.discountPercentage) / 100);

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            coupon: {
                code: coupon.code,
                discountPercentage: coupon.discountPercentage,
                discountAmount,
                minimumAmount: coupon.minimumAmount
            }
        });
    } catch (error) {
        console.error('Validate coupon error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to validate coupon' 
        });
    }
};

// Use coupon (called after successful payment)
const useCoupon = async (code) => {
    try {
        // Validate code is a string
        if (!code || typeof code !== 'string') {
            throw new Error('Invalid coupon code format');
        }
        
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        
        if (!coupon) {
            throw new Error('Coupon not found');
        }

        if (!coupon.isValid()) {
            throw new Error('Coupon is no longer valid');
        }

        // Increment usage count
        coupon.usedCount += 1;
        await coupon.save();

        return {
            success: true,
            discountPercentage: coupon.discountPercentage
        };
    } catch (error) {
        console.error('Use coupon error:', error);
        throw error;
    }
};

// Delete coupon (Admin only)
const removeCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findByIdAndDelete(id);

        if (!coupon) {
            return res.status(404).json({ 
                success: false, 
                message: 'Coupon not found' 
            });
        }

        res.json({
            success: true,
            message: 'Coupon deleted successfully'
        });
    } catch (error) {
        console.error('Remove coupon error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete coupon' 
        });
    }
};

// Update coupon (Admin only)
const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // If code is being updated, check for duplicates
        if (updates.code) {
            const existing = await Coupon.findOne({ 
                code: updates.code.toUpperCase(),
                _id: { $ne: id }
            });
            if (existing) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Coupon code already exists' 
                });
            }
            updates.code = updates.code.toUpperCase();
        }

        const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });

        if (!coupon) {
            return res.status(404).json({ 
                success: false, 
                message: 'Coupon not found' 
            });
        }

        res.json({
            success: true,
            message: 'Coupon updated successfully',
            coupon
        });
    } catch (error) {
        console.error('Update coupon error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update coupon' 
        });
    }
};

module.exports = {
    addCoupon,
    listCoupons,
    validateCoupon,
    useCoupon,
    removeCoupon,
    updateCoupon
};
