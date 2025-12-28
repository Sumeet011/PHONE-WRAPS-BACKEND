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
        const estimatedWeight = totalQuantity * 0.05; // Assuming 50g per phone wrap (in KG)

        // Prepare shipment data according to iThink Logistics API v3 format
        const shipmentData = {
            data: {
                shipments: [{
                    order: orderNumber || orderId,
                    order_date: new Date().toISOString().split('T')[0],
                    total_amount: parseFloat((totalAmount || subtotal || 0).toFixed(2)),
                    name: shippingAddress.fullName || shippingAddress.name || "Customer",
                    company_name: "",
                    add: shippingAddress.addressLine1 || shippingAddress.address || "",
                    add2: shippingAddress.addressLine2 || "",
                    add3: "",
                    pin: String(shippingAddress.zipCode || shippingAddress.pincode || ""),
                    city: shippingAddress.city || "",
                    state: shippingAddress.state || "",
                    country: "India",
                    phone: String(shippingAddress.phoneNumber || shippingAddress.phone || ""),
                    email: shippingAddress.email || "",
                    is_billing_same_as_shipping: "yes",
                    billing_name: shippingAddress.fullName || shippingAddress.name || "Customer",
                    billing_add: shippingAddress.addressLine1 || shippingAddress.address || "",
                    billing_pin: String(shippingAddress.zipCode || shippingAddress.pincode || ""),
                    billing_city: shippingAddress.city || "",
                    billing_state: shippingAddress.state || "",
                    billing_country: "India",
                    billing_phone: String(shippingAddress.phoneNumber || shippingAddress.phone || ""),
                    billing_email: shippingAddress.email || "",
                    products: items.map(item => ({
                        product_name: item.productName || item.name || 'Product',
                        product_sku: item.productId?.toString() || item.sku || 'SKU000',
                        product_quantity: String(item.quantity || 1),
                        product_price: String(parseFloat((item.price || 0).toFixed(2)))
                    })),
                    shipment_length: "25",
                    shipment_width: "15",
                    shipment_height: "2",
                    weight: String(estimatedWeight),
                    shipping_charges: String(parseFloat((orderData.shippingCost || 0).toFixed(2))),
                    giftwrap_charges: "0",
                    transaction_charges: "0",
                    total_discount: String(parseFloat((orderData.discount || 0).toFixed(2))),
                    cod_amount: paymentMethod === 'COD' ? String(parseFloat((totalAmount || subtotal || 0).toFixed(2))) : "0",
                    payment_mode: paymentMethod === 'COD' ? 'COD' : 'Prepaid',
                    return_address_id: process.env.ITHINK_RETURN_ADDRESS_ID || "1"
                }],
                pickup_address_id: process.env.ITHINK_PICKUP_ADDRESS_ID || "95881",
                access_token: ITHINK_API_KEY,
                secret_key: ITHINK_SECRET_KEY,
                logistics: "",
                s_type: "",
                order_type: ""
            }
        };

        console.log('📦 Shipment payload:', JSON.stringify(shipmentData, null, 2));

        console.log('📦 Shipment payload:', JSON.stringify(shipmentData, null, 2));
        console.log('📦 Sending shipment data to iThink Logistics...');
        console.log('📦 API URL:', `${ITHINK_API_URL}/order/add.json`);

        // Make API request to iThink Logistics
        const response = await axios.post(
            `${ITHINK_API_URL}/order/add.json`,
            shipmentData,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            }
        );

        console.log('✅ iThink Logistics shipment created:', response.data);

        return {
            success: true,
            data: response.data,
            awbCode: response.data?.awb_code || response.data?.data?.awb_code || null,
            shipmentId: response.data?.shipment_id || response.data?.data?.order_id || null,
            courierName: response.data?.courier_name || response.data?.data?.courier_name || null
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
            `${ITHINK_API_URL}/order/track`,
            {
                params: { awb_code: awbCode },
                headers: {
                    'Access-Token': ITHINK_API_KEY,
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
            `${ITHINK_API_URL}/order/cancel`,
            { awb_code: awbCode },
            {
                headers: {
                    'Access-Token': ITHINK_API_KEY,
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
