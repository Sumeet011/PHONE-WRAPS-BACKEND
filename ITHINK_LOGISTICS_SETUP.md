# iThink Logistics Integration

## Overview
This project now includes automatic shipment creation with iThink Logistics when orders are confirmed after successful payment.

## Features
- ✅ Automatic shipment creation when payment is confirmed
- ✅ AWB (Air Waybill) code generation
- ✅ Tracking number assignment
- ✅ Courier partner information
- ✅ Order status updates
- ✅ Shipment tracking capability
- ✅ Shipment cancellation support

## Setup Instructions

### 1. Get iThink Logistics Credentials

1. Sign up for an account at [iThink Logistics](https://www.ithinklogistics.com/)
2. Go to your dashboard and navigate to API Settings
3. Copy your API Key and Secret Key
4. Note your Pickup Location name (usually "Primary" or your warehouse name)

### 2. Configure Environment Variables

Add the following to your `.env` file in `BACKEND/Src/`:

```env
# iThink Logistics Configuration
ITHINK_API_URL=https://pre-alpha.ithinklogistics.com/api_v3
ITHINK_API_KEY=your_actual_api_key_here
ITHINK_SECRET_KEY=your_actual_secret_key_here
ITHINK_PICKUP_LOCATION=Primary
```

**Important:** Replace the placeholder values with your actual iThink Logistics credentials.

### 3. Configure Pickup Location

In your iThink Logistics dashboard:
1. Go to "Pickup Locations"
2. Add or verify your warehouse/pickup address
3. Use the exact name in the `ITHINK_PICKUP_LOCATION` variable

## How It Works

### Automatic Shipment Creation Flow

1. **Customer places order** → Payment is processed via Razorpay
2. **Payment confirmed** → Order is created in database with status "Confirmed"
3. **Shipment created** → Automatically sends order to iThink Logistics
4. **AWB received** → Order updated with AWB code and status changes to "Processing"
5. **Customer notified** → Can track their shipment using the AWB code

### Order Status Progression

```
Pending → Confirmed → Processing → Shipped → Out for Delivery → Delivered
         ↓
    (Payment + Shipment Creation)
```

## API Endpoints

The integration adds the following capabilities through the order controller:

### Create Shipment (Automatic)
- Triggered automatically after payment confirmation
- No manual API call needed

### Track Shipment
```javascript
// In iThinkLogistics.js
trackShipment(awbCode)
```

### Cancel Shipment
```javascript
// In iThinkLogistics.js
cancelShipment(awbCode)
```

## Database Fields

The Order model now includes:

```javascript
{
  awbCode: String,          // AWB tracking code from iThink
  shipmentId: String,       // Shipment ID from iThink
  trackingNumber: String,   // Same as AWB code
  courierPartner: String,   // Courier name (e.g., "Delhivery")
  trackingLink: String      // Full tracking URL
}
```

## Error Handling

The system is designed to be fault-tolerant:

- ✅ Order will still be created even if shipment creation fails
- ⚠️ Errors are logged but don't block order completion
- 📧 Admin should monitor logs for shipment creation failures
- 🔄 Failed shipments can be manually created later

## Testing

### Test Mode
iThink Logistics provides a sandbox/test environment. Check with their support for test credentials.

### Manual Testing Steps

1. Place a test order with valid shipping address
2. Complete payment
3. Check order in database for AWB code
4. Verify shipment appears in iThink Logistics dashboard
5. Test tracking with the AWB code

## Production Checklist

Before going live:

- [ ] Update `.env` with production API credentials
- [ ] Test with real shipping addresses
- [ ] Configure webhook endpoints (if needed)
- [ ] Set up monitoring for failed shipment creations
- [ ] Verify pickup location details are correct
- [ ] Test cancellation flow
- [ ] Set up automated alerts for failed shipments

## Monitoring & Logs

Look for these log messages:

```
✅ Shipment created! AWB: XXXXXXXXXXXXX
⚠️ Shipment creation failed: [error message]
📦 Creating shipment in iThink Logistics...
```

## Troubleshooting

### Shipment Creation Fails
1. Verify API credentials are correct
2. Check pickup location name matches exactly
3. Ensure shipping address is complete and valid
4. Check iThink Logistics API status
5. Review error logs for specific error messages

### Missing AWB Code
1. Check if `ITHINK_API_KEY` and `ITHINK_SECRET_KEY` are set
2. Verify order payment was successful
3. Look for error logs during order creation
4. Manually create shipment through iThink dashboard if needed

### Invalid Addresses
- Ensure all address fields are filled
- PIN code must be valid Indian PIN code
- Phone number must be valid 10-digit number
- State and city must match PIN code

## Support

- **iThink Logistics Support:** support@ithinklogistics.com
- **API Documentation:** Contact iThink Logistics for API docs
- **Integration Issues:** Check backend logs in `BACKEND/Src/`

## Notes

- Shipment creation happens only for **paid orders**
- COD orders also create shipments (set payment_method as "COD")
- Weight is estimated at 50g per phone wrap (adjust in `iThinkLogistics.js` if needed)
- Default package dimensions: 25cm x 15cm x 2cm (adjust as needed)
- API timeout is set to 30 seconds

## Future Enhancements

- [ ] Webhook integration for real-time tracking updates
- [ ] Bulk shipment creation
- [ ] Rate calculation before checkout
- [ ] Serviceability check by PIN code
- [ ] Return/RTO handling
- [ ] Automated tracking status updates
