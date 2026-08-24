# Quick Reference Guide - Clearance Sale Customization

## 🚀 Start Testing Now

### Step 1: Verify Backend is Running
```bash
# Terminal 1: Start backend
cd backend
npm start
# Expected output: Backend API Running 🚀
```

### Step 2: Access Admin Page
Navigate to: `https://[your-app-url]/admin/customization/clearance-sale`

### Step 3: Test Save/Load
1. Change Font Family field to "Georgia"
2. Click "Save changes"
3. See success message ✓
4. Refresh page → "Georgia" still appears ✓

### Step 4: Test Storefront
1. Visit your store's product page with clearance sale
2. Verify widget shows custom styling
3. Inspect element → Check CSS variables are set
4. Refresh page → Styling persists ✓

---

## 📋 API Quick Reference

### Admin APIs (All require `?shop=SHOP_DOMAIN`)
```
GET  /api/customization/clearance-sale
POST /api/customization/clearance-sale
POST /api/customization/clearance-sale/reset
```

### Storefront API (Public)
```
GET /api/storefront/product-widget?shop=X&productId=Y&variantId=Z
```

### Response Example
```json
{
  "clearanceConfig": {
    "fontFamily": "Georgia",
    "fontSize": "15px",
    "fontWeight": "700",
    "backgroundColor": "#FFF1F2",
    "textColor": "#991B1B",
    "borderColor": "#FECACA",
    "layout": "horizontal",
    "alignment": "left",
    "borderRadius": 8,
    "paddingTop": 14,
    "paddingBottom": 14,
    "paddingLeft": 16,
    "paddingRight": 16
  }
}
```

---

## 🔍 Debugging Checklist

### Admin Changes Not Saving?
- [ ] Check backend is running: `npm start` in backend/
- [ ] Check browser console for fetch errors
- [ ] Verify shop parameter is in URL
- [ ] Check MongoDB connection in backend logs

### Storefront Not Showing Changes?
- [ ] Hard refresh storefront (Ctrl+Shift+R)
- [ ] Check browser DevTools Network tab for `/apps/smart-stock/product-widget`
- [ ] Verify response includes `clearanceConfig`
- [ ] Inspect element to see if CSS variables are set

### Check CSS Variables Applied
```javascript
// Run in storefront console
const el = document.querySelector('.smart-stock-clearance-sale');
console.log(getComputedStyle(el).fontFamily);
console.log(getComputedStyle(el).backgroundColor);
console.log(getComputedStyle(el).color);
```

### Verify Database Saved
```javascript
// Run in MongoDB Compass or mongo shell
db.clearancesaleconfigs.find({ shopId: "your-shop.myshopify.com" })
```

---

## 📊 Expected Data Flow

```
Input: Font Family → "Georgia"
         Font Size → "16px"
         Background → "#FF0000"

↓ Merchant clicks "Save"

POST /api/customization/clearance-sale
{
  "fontFamily": "Georgia",
  "fontSize": "16px",
  "backgroundColor": "#FF0000",
  ...
}

↓ Backend saves to MongoDB

ClearanceSaleConfig {
  shopId: "myshop.myshopify.com",
  fontFamily: "Georgia",
  fontSize: "16px",
  backgroundColor: "#FF0000"
  ...
}

↓ Storefront fetches

GET /apps/smart-stock/product-widget?shop=myshop.myshopify.com

↓ Backend returns

{
  clearanceConfig: {
    fontFamily: "Georgia",
    fontSize: "16px",
    backgroundColor: "#FF0000",
    ...
  }
}

↓ Liquid/JS applies to widget

<div class="smart-stock-clearance-sale" 
     style="--smart-stock-clearance-font-family: Georgia;
             --smart-stock-clearance-font-size: 16px;
             --smart-stock-clearance-bg: #FF0000;">
</div>

↓ Browser renders

🏷️ Clearance Sale widget displayed with Georgia font, 16px size, red background
```

---

## 🎯 Feature Checklist

### Typography Control
- [x] Font Family input field
- [x] Font Size input field with px unit
- [x] Font Weight selector (300-700)
- [x] Applied to storefront widget
- [x] Persisted in MongoDB
- [x] Live preview in admin

### Color Control
- [x] Background color picker
- [x] Text color picker
- [x] Accent color picker
- [x] Border color picker
- [x] Hex validation
- [x] Applied to storefront

### Layout Control
- [x] Layout type selector (Horizontal/Stacked)
- [x] Alignment selector (Left/Center/Right)
- [x] Border radius slider (0-50px)
- [x] Padding sliders (top/bottom/left/right)
- [x] Applied to widget

### Data Persistence
- [x] Saved to MongoDB per shop
- [x] Retrieved on admin page load
- [x] Retrieved on storefront load
- [x] Survives page refresh
- [x] Shop isolation enforced

### Error Handling
- [x] Invalid input validation
- [x] API error handling
- [x] Graceful degradation to defaults
- [x] User feedback (success/error messages)

---

## 🔧 Common Issues & Solutions

### Issue: "API Route Not Found" error
**Solution:**
- Verify backend routes are mounted correctly in `backend/server.js`
- Check that `/api/customization` route is mounted
- Restart backend: `npm start`

### Issue: Settings saved but not appearing on storefront
**Solution:**
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh storefront (Ctrl+Shift+R)
- Check MongoDB to verify data was saved
- Verify storefront is fetching from correct shop parameter

### Issue: Storefront showing defaults instead of custom styling
**Solution:**
- Check browser console for API errors
- Verify `/apps/smart-stock/product-widget` returns correct response
- Check if merchant config exists in MongoDB
- Verify CSS variables are being set on element

### Issue: "Shop domain is required" error
**Solution:**
- Ensure shop parameter is passed in API request
- Verify request includes correct headers or query params
- Check `authenticateShop` middleware is applied to routes

### Issue: Color picker not working
**Solution:**
- Verify input is valid hex color (e.g., #FF0000)
- Check browser console for validation errors
- Try simple color like #FF0000 first
- Verify form state is updating (check React DevTools)

---

## 📈 Performance Tips

### Frontend Optimization
- Live preview updates are optimized (debounced)
- Form state managed efficiently with React hooks
- API calls batched where possible

### Backend Optimization
- Database queries indexed on shopId for O(1) lookup
- Response includes only necessary fields
- No unnecessary joins or population

### Storefront Optimization
- CSS variables cached by browser
- Single API call per page load
- Inline styles applied once
- No re-renders on style updates

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Test on staging environment first
- [ ] Verify MongoDB backup exists
- [ ] Check environment variables are set:
  - BACKEND_URL
  - MongoDB connection string
  - Shopify API credentials
- [ ] Test with multiple shops
- [ ] Verify shop isolation works
- [ ] Load test the API endpoints
- [ ] Monitor error logs after deployment
- [ ] Have rollback plan ready

---

## 📞 Support Resources

### Key Files to Check
- Admin UI: `src/pages/Customization/ClearanceSaleCustomization.jsx`
- Backend Controller: `backend/controllers/customizationController.js`
- Database Model: `backend/models/ClearanceSaleConfig.js`
- Storefront Template: `extensions/smart-stock-theme-ext/blocks/clearance_sale.liquid`
- Embed Script: `extensions/smart-stock-theme-ext/assets/smart-stock-embed.js`

### Documentation Files
- `IMPLEMENTATION_COMPLETE.md` - Full implementation details
- `CLEARANCE_SALE_CUSTOMIZATION_COMPLETE.md` - Complete architecture guide
- `CLEARANCE_SALE_CUSTOMIZATION_TESTING.md` - Comprehensive testing guide

### API Testing
- Use Postman or curl to test endpoints
- Example: `curl "http://localhost:5000/api/customization/clearance-sale?shop=test.myshopify.com"`

### Database Inspection
- MongoDB Compass: `mongodb://localhost:27017`
- Collection: `clearancesaleconfigs`
- Query: `{ shopId: "shop.myshopify.com" }`

---

## ✅ Final Verification

Run this checklist before considering implementation complete:

1. **Admin Page**
   - [ ] Page loads without errors
   - [ ] All input fields are visible
   - [ ] Live preview updates when changing values
   - [ ] Save button sends API request
   - [ ] Success message appears

2. **Database**
   - [ ] Config saved in MongoDB
   - [ ] shopId is unique index
   - [ ] All fields present in document

3. **Storefront API**
   - [ ] Endpoint returns 200 OK
   - [ ] Response includes clearanceConfig
   - [ ] clearanceConfig contains all merchant values
   - [ ] Cache headers are set correctly

4. **Storefront Display**
   - [ ] Widget appears on product page
   - [ ] CSS variables set on element
   - [ ] Typography applied correctly
   - [ ] Colors applied correctly
   - [ ] Layout and spacing correct

5. **Persistence**
   - [ ] Admin refresh → values still there
   - [ ] Storefront refresh → styling persists
   - [ ] Different shops → different settings

6. **Error Handling**
   - [ ] Invalid input → validation error
   - [ ] API error → graceful fallback
   - [ ] Missing shop → handled safely

---

## 🎉 Success Criteria

The implementation is successful when:

✅ Merchant changes Typography/Colors in Admin
✅ Settings saved to MongoDB (per shop)
✅ Storefront fetches latest settings
✅ Widget displays merchant customization
✅ Refreshing page preserves styling
✅ Each shop has isolated settings
✅ No hardcoded defaults override merchant settings
✅ All data flows work end-to-end
✅ No console errors
✅ User can test with confidence

---

**Status: Ready for Testing** 🚀

The complete system is implemented and ready for comprehensive testing.
All documentation is available in the project root.

Good luck with your testing!
