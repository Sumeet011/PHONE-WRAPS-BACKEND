# Quick Start Guide - Production Deployment

## Prerequisites Checklist
- [ ] Node.js 18+ installed
- [ ] MongoDB Atlas account set up
- [ ] Cloudinary account configured
- [ ] Razorpay account (for payments)
- [ ] Domain/hosting platform ready

## 5-Minute Setup

### 1. Environment Variables (CRITICAL)
```bash
# Copy the example file
cp .env.example .env

# Generate secure JWT secret (REQUIRED)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Edit .env file with your values
nano .env  # or use your preferred editor
```

**Required Variables:**
```env
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_64_character_random_secret
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Test Locally
```bash
# Set to development first
NODE_ENV=development npm start

# Test endpoints
curl http://localhost:3000/api/products
```

### 4. Deploy

#### Option A: Vercel (Recommended for easy deployment)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Deploy to production
vercel --prod
```

#### Option B: Heroku
```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret
heroku config:set MONGODB_URI=your_uri
# ... set all other variables

# Deploy
git push heroku main
```

#### Option C: VPS (DigitalOcean, AWS EC2, etc.)
```bash
# On your server
git clone your-repo
cd BACKEND
npm install --production
npm install -g pm2

# Set environment variables
nano .env

# Start with PM2
pm2 start Src/server.js --name phone-wraps-api
pm2 startup
pm2 save

# Configure Nginx reverse proxy (see below)
```

## Nginx Configuration (for VPS)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Verify Deployment

### Health Checks
```bash
# Check if server is running
curl https://your-domain.com/api/products

# Check database connection (create a test endpoint)
curl https://your-domain.com/api/health
```

### Test Critical Endpoints
```bash
# Test authentication
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Test product listing
curl https://your-domain.com/api/products

# Test protected endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/orders
```

## Common Issues & Solutions

### Issue: "JWT_SECRET is not defined"
**Solution:** Ensure JWT_SECRET is set in environment variables
```bash
# Check if it's set
echo $JWT_SECRET

# Set it
export JWT_SECRET="your-secret"
# Or add to .env file
```

### Issue: "MongoDB connection failed"
**Solution:** 
1. Check MONGODB_URI format
2. Verify IP whitelist in MongoDB Atlas
3. Ensure network connectivity

### Issue: "CORS error from frontend"
**Solution:** Add your frontend domain to allowed origins in [server.js](Src/server.js)

### Issue: "Cloudinary upload fails"
**Solution:** Verify Cloudinary credentials are correct

## Monitoring Commands

```bash
# View logs
pm2 logs phone-wraps-api

# Monitor resources
pm2 monit

# Check status
pm2 status

# Restart
pm2 restart phone-wraps-api

# Stop
pm2 stop phone-wraps-api
```

## Security Reminders

✅ **DO:**
- Use strong JWT secrets (64+ characters)
- Enable HTTPS/SSL certificates
- Keep dependencies updated
- Monitor logs regularly
- Back up database daily

❌ **DON'T:**
- Commit .env file to git
- Use weak or default secrets
- Expose API keys in client code
- Ignore security updates
- Run as root user (on VPS)

## Performance Tips

1. **Enable Compression** (if not using Nginx)
```javascript
const compression = require('compression');
app.use(compression());
```

2. **Use CDN** for static assets (Cloudinary is already configured)

3. **Monitor Memory** 
```bash
pm2 monit
```

4. **Database Indexes** (already implemented)

## Need Help?

1. Check [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for detailed guide
2. Review [IMPROVEMENTS_SUMMARY.md](IMPROVEMENTS_SUMMARY.md) for all changes
3. Check logs for error details
4. Verify environment variables are set correctly

---

## Ready to Deploy? ✅

- [ ] Environment variables configured
- [ ] JWT secret generated and set
- [ ] MongoDB connection string updated
- [ ] Cloudinary credentials set
- [ ] All tests passed locally
- [ ] CORS origins updated
- [ ] Deployment platform chosen
- [ ] Monitoring set up

**You're all set! Deploy with confidence! 🚀**

---

**Quick Deploy Commands:**

```bash
# Vercel
vercel --prod

# Heroku
git push heroku main

# VPS with PM2
pm2 restart phone-wraps-api

# Docker
docker-compose up -d
```
