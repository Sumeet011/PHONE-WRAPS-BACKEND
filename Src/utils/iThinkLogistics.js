const {ITL_CONFIG} =require("../config/ithink");
const axios = require('axios');
require('dotenv').config();


/**
 * iThink Logistics API Integration Service
 * Automatically creates shipments when orders are confirmed
 */

const ITHINK_API_URL = ITL_CONFIG.baseUrl;
const ITHINK_API_KEY = ITL_CONFIG.accessToken;
const ITHINK_SECRET_KEY = ITL_CONFIG.secretKey;
const ITHINK_PICKUP_LOCATION = process.env.ITHINK_PICKUP_LOCATION || 'Primary';

if (!ITHINK_API_KEY || !ITHINK_SECRET_KEY) {
    console.warn('⚠️ iThink Logistics credentials not found. Shipment creation will be disabled.');
}

const toSafeInteger = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(0, Math.floor(parsed));
};

const toSafePrice = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(0, parsed);
};

const buildShipmentProducts = (items = [], plates = []) => {
    const shipmentProducts = [];

    items.forEach((item, index) => {
        const option = item.productOption || 'none';
        const quantity = Math.max(1, toSafeInteger(item.quantity, 1));
        const price = toSafePrice(item.price, 0);
        const platePrice = toSafePrice(item.platePrice, 0);
        const productName = item.productName || item.name || `Product ${index + 1}`;
        const productSku = item.productId?.toString() || item.sku || `ITEM-${index + 1}`;
        const productImage = item.image || item.collectionImage || item.customDesign?.designImageUrl || item.customDesign?.originalImageUrl || '';

        if (option !== 'plates-only') {
            shipmentProducts.push({
                product_name: productName,
                product_sku: productSku,
                product_quantity: String(quantity),
                product_price: String(price),
                product_tax_rate: "0",
    product_hsn_code: "",
    product_discount: "0",
                ...(productImage ? { product_img_url: productImage } : {})
            });
        }

        if (option === 'cover+plates') {
            shipmentProducts.push({
                product_name: `${productName} Plates`,
                product_sku: `${productSku}-PLATE`,
                product_quantity: String(quantity),
                product_price: String(platePrice),
                product_tax_rate: "0",
    product_hsn_code: "",
    product_discount: "0",
                ...(productImage ? { product_img_url: productImage } : {})
            });
        }
    });

    plates.forEach((plate, index) => {
        const quantity = Math.max(1, toSafeInteger(plate.quantity, 1));
        const price = toSafePrice(plate.pricePerPlate, 0);
        const productName = `${plate.collectionName || `Plate ${index + 1}`} Plates`;
        const productSku = `${plate.collectionId?.toString() || 'PLATE'}-${plate.phoneModel || index}`;

        shipmentProducts.push({
            product_name: productName,
            product_sku: productSku,
            product_quantity: String(quantity),
            product_price: String(price),
            product_tax_rate: "0",
    product_hsn_code: "",
    product_discount: "0",
            ...(plate.collectionImage ? { product_img_url: plate.collectionImage } : {})
        });
    });

    return shipmentProducts;
};

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
            plates = [],
            shippingAddress, 
            totalAmount,
            paymentMethod,
            subtotal
        } = orderData;

        const shipmentProducts = buildShipmentProducts(items, plates);

        // Calculate total quantity and weight
        const totalQuantity = shipmentProducts.reduce((sum, product) => sum + toSafeInteger(product.product_quantity, 0), 0);
        const estimatedWeight = totalQuantity * 0.05; // Assuming 50g per phone wrap (in KG)

        // Prepare shipment data according to iThink Logistics API v3 format
       const shipmentData= {
    waybill: "",
    order: orderNumber || orderId,
    sub_order: orderNumber || orderId,

    order_date: new Date().toISOString().split("T")[0],

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
    alt_phone: String(shippingAddress.phoneNumber || shippingAddress.phone || ""),
    email: shippingAddress.email || "",

    is_billing_same_as_shipping: "yes",

    billing_name: shippingAddress.fullName || shippingAddress.name || "Customer",
    billing_company_name: "",
    billing_add: shippingAddress.addressLine1 || shippingAddress.address || "",
    billing_add2: shippingAddress.addressLine2 || "",
    billing_add3: "",
    billing_pin: String(shippingAddress.zipCode || shippingAddress.pincode || ""),
    billing_city: shippingAddress.city || "",
    billing_state: shippingAddress.state || "",
    billing_country: "India",
    billing_phone: String(shippingAddress.phoneNumber || shippingAddress.phone || ""),
    billing_alt_phone: String(shippingAddress.phoneNumber || shippingAddress.phone || ""),
    billing_email: shippingAddress.email || "",

    products: shipmentProducts,

    shipment_length: "25",
    shipment_width: "15",
    shipment_height: "2",

    weight: String(estimatedWeight),

    shipping_charges: String(parseFloat((orderData.shippingCost || 0).toFixed(2))),
    giftwrap_charges: "0",
    transaction_charges: "0",
    total_discount: String(parseFloat((orderData.discount || 0).toFixed(2))),
    first_attemp_discount: "0",
    cod_charges: "0",
    advance_amount:
        paymentMethod === "COD"
            ? "0"
            : String(parseFloat((totalAmount || subtotal || 0).toFixed(2))),
    cod_amount:
        paymentMethod === "COD"
            ? String(parseFloat((totalAmount || subtotal || 0).toFixed(2)))
            : "0",

    payment_mode: paymentMethod === "COD" ? "COD" : "Prepaid",

    reseller_name: "",
    eway_bill_number: "",
    gst_number: "",
    what3words: "",

    return_address_id: process.env.ITHINK_RETURN_ADDRESS_ID || "1",

    api_source: "0",
    store_id: process.env.ITHINK_STORE_ID || ""
}

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

        const shipmentRecord = response.data?.data?.shipments?.[0] || response.data?.shipments?.[0] || response.data?.data || response.data || {};

        return {
            success: true,
            data: response.data,
            awbCode: shipmentRecord.awb_code || shipmentRecord.awbCode || response.data?.awb_code || response.data?.data?.awb_code || null,
            shipmentId: shipmentRecord.shipment_id || shipmentRecord.order_id || response.data?.shipment_id || response.data?.data?.order_id || null,
            courierName: shipmentRecord.courier_name || shipmentRecord.courierName || response.data?.courier_name || response.data?.data?.courier_name || null
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

        const response = await axios.post(
            `${ITHINK_API_URL}/order/track.json`,
            {
                data: {
                    awb_number_list: String(awbCode),
                    access_token: ITHINK_API_KEY,
                    secret_key: ITHINK_SECRET_KEY
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const trackingRecord = response.data?.data?.[0] || response.data?.data?.shipments?.[0] || response.data?.data || response.data || {};

        return {
            success: true,
            data: response.data,
            trackingRecord,
            status: trackingRecord.status || trackingRecord.current_status || trackingRecord.order_status || null,
            statusCode: trackingRecord.status_code || trackingRecord.code || null,
            message: trackingRecord.message || trackingRecord.reason || null
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
            `${ITHINK_API_URL}/order/cancel.json`,
            {
                data: {
                    access_token: ITHINK_API_KEY,
                    secret_key: ITHINK_SECRET_KEY,
                    awb_numbers: String(awbCode)
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000,
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
