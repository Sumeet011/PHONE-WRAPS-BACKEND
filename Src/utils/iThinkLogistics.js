const axios = require('axios');
require('dotenv').config();

/**
 * iThink Logistics API Integration Service
 * Automatically creates shipments when orders are confirmed
 */

const ITHINK_API_URL = process.env.ITHINK_API_URL || 'https://pre-alpha.ithinklogistics.com/api_v3';
const ITHINK_API_KEY = process.env.ITHINK_API_KEY;
const ITHINK_SECRET_KEY = process.env.ITHINK_SECRET_KEY;
const ITHINK_PICKUP_LOCATION = process.env.ITHINK_PICKUP_LOCATION || 'Primary';

if (!ITHINK_API_KEY || !ITHINK_SECRET_KEY) {
    console.warn('⚠️ iThink Logistics credentials not found. Shipment creation will be disabled.');
}

/**
 * Create a shipment in iThink Logistics
 * @param {Object} orderData - Order information
 * @returns {Object} Shipment creation result
 */
const createShipment = async (orderData) => {
    try {
        if (!ITHINK_API_KEY || !ITHINK_SECRET_KEY) {
            console.log('⚠️ iThink Logistics not configured, skipping shipment creation');
            return { success: false, message: 'iThink Logistics not configured' };
        }

        const { 
            orderId, 
            orderNumber,
            items, 
            shippingAddress, 
            totalAmount,
            paymentMethod,
            subtotal
        } = orderData;

        // Calculate total quantity and weight
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const estimatedWeight = totalQuantity * 0.05; // Assuming 50g per phone wrap

        // Prepare shipment data for iThink Logistics
        const shipmentData = {
            data: {
                order_id: orderNumber || orderId,
                order_date: new Date().toISOString().split('T')[0],
                pickup_location: ITHINK_PICKUP_LOCATION,
                channel_id: "",
                comment: "Phone Wrap Order",
                billing_customer_name: shippingAddress.fullName,
                billing_last_name: "",
                billing_address: shippingAddress.addressLine1,
                billing_address_2: shippingAddress.addressLine2 || "",
                billing_city: shippingAddress.city,
                billing_pincode: shippingAddress.zipCode,
                billing_state: shippingAddress.state,
                billing_country: shippingAddress.country || "India",
                billing_email: shippingAddress.email,
                billing_phone: shippingAddress.phoneNumber,
                shipping_is_billing: true,
                shipping_customer_name: "",
                shipping_last_name: "",
                shipping_address: "",
                shipping_address_2: "",
                shipping_city: "",
                shipping_pincode: "",
                shipping_country: "",
                shipping_state: "",
                shipping_email: "",
                shipping_phone: "",
                order_items: items.map(item => ({
                    name: item.productName,
                    sku: item.productId?.toString() || 'SKU000',
                    units: item.quantity,
                    selling_price: item.price,
                    discount: "",
                    tax: "",
                    hsn: ""
                })),
                payment_method: paymentMethod === 'COD' ? 'COD' : 'Prepaid',
                shipping_charges: orderData.shippingCost || 0,
                giftwrap_charges: 0,
                transaction_charges: 0,
                total_discount: orderData.discount || 0,
                sub_total: subtotal,
                length: 25,  // Default dimensions in cm
                breadth: 15,
                height: 2,
                weight: estimatedWeight
            }
        };

        // Make API request to iThink Logistics
        const response = await axios.post(
            `${ITHINK_API_URL}/create_order.json`,
            shipmentData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ITHINK_API_KEY}`,
                    'Secret-Key': ITHINK_SECRET_KEY
                },
                timeout: 30000 // 30 second timeout
            }
        );

        console.log('✅ iThink Logistics shipment created:', response.data);

        return {
            success: true,
            data: response.data,
            awbCode: response.data?.awb_code || null,
            shipmentId: response.data?.shipment_id || null,
            courierName: response.data?.courier_name || null
        };

    } catch (error) {
        console.error('❌ iThink Logistics shipment creation failed:', error.message);
        
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }

        return {
            success: false,
            message: error.message,
            error: error.response?.data || error.message
        };
    }
};

/**
 * Track a shipment
 * @param {String} awbCode - AWB tracking code
 * @returns {Object} Tracking information
 */
const trackShipment = async (awbCode) => {
    try {
        if (!ITHINK_API_KEY || !ITHINK_SECRET_KEY) {
            return { success: false, message: 'iThink Logistics not configured' };
        }

        const response = await axios.get(
            `${ITHINK_API_URL}/track_awb.json`,
            {
                params: { awb_code: awbCode },
                headers: {
                    'Authorization': `Bearer ${ITHINK_API_KEY}`,
                    'Secret-Key': ITHINK_SECRET_KEY
                }
            }
        );

        return {
            success: true,
            data: response.data
        };

    } catch (error) {
        console.error('❌ Shipment tracking failed:', error.message);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * Cancel a shipment
 * @param {String} awbCode - AWB tracking code
 * @returns {Object} Cancellation result
 */
const cancelShipment = async (awbCode) => {
    try {
        if (!ITHINK_API_KEY || !ITHINK_SECRET_KEY) {
            return { success: false, message: 'iThink Logistics not configured' };
        }

        const response = await axios.post(
            `${ITHINK_API_URL}/cancel_order.json`,
            { awb_code: awbCode },
            {
                headers: {
                    'Authorization': `Bearer ${ITHINK_API_KEY}`,
                    'Secret-Key': ITHINK_SECRET_KEY
                }
            }
        );

        return {
            success: true,
            data: response.data
        };

    } catch (error) {
        console.error('❌ Shipment cancellation failed:', error.message);
        return {
            success: false,
            message: error.message
        };
    }
};

module.exports = {
    createShipment,
    trackShipment,
    cancelShipment
};
