# Clearance Sale Customization - Complete Testing Guide

## System Overview

The Clearance Sale customization system allows merchants to customize Typography and Colors settings in the Shopify Admin, which are then applied dynamically to the storefront widget.

**Data Flow:**
```
Merchant changes settings → Admin UI
                           ↓
                     Backend API saves
                           ↓
                      MongoDB (per shop)
                           ↓
                    Storefront API fetches
                           ↓
                  Liquid template + Embed JS
                           ↓
                    Applies to widget styling
```

---

## Components & Files

### 1. Admin Interface
- **File**: `src/pages/Customization/ClearanceSaleCustomization.jsx`
- **Route**: `app/routes/app.customization.clearance-sale.jsx`
- **URL**: `/admin/customization/clearance-sale`
- **Features**:
  - Typography: Font Family, Font Size, Font Weight
  - Colors: Background, Text, Accent, Border
  - Layout: Horizontal/Stacked, Alignment
  - Spacing: Border radius, Padding
  - Live preview that updates in real-time

### 2. Backend API
- **Endpoints**:
  - `GET /api/customization/clearance-sale?shop=X` - Fetch saved config
  - `POST /api/customization/clearance-sale` - Save config
  - `POST /api/customization/clearance-sale/reset` - Reset to defaults
- **Controller**: `backend/controllers/customizationController.js`
- **Database**: `backend/models/ClearanceSaleConfig.js`
- **Sanitization**: All input values validated before saving

### 3. Storefront API
- **Endpoint**: `GET /api/storefront/product-widget?shop=X&productId=Y&variantId=Z`
- **App Proxy Path**: `/apps/smart-stock/product-widget`
- **Controller**: `backend/controllers/storefrontController.js`
- **Response**:
  ```json
  {
    "clearanceConfig": {
      "fontFamily": "Arial",
      "fontSize": "13px",
      "fontWeight": "600",
      "backgroundColor": "#FFF1F2",
      "textColor": "#991B1B",
      "borderColor": "#FECACA",
      ...
    },
    "deadStockOffer": { ... }
  }
  ```

### 4. Storefront Rendering
- **Liquid Template**: `extensions/smart-stock-theme-ext/blocks/clearance_sale.liquid`
- **Embed Script**: `extensions/smart-stock-theme-ext/assets/smart-stock-embed.js`
- **CSS**: `extensions/smart-stock-theme-ext/assets/smart-stock-embed.css`

---

## Test Plan

### Test 1: Admin UI - Load Initial Config
**Steps:**
1. Open `/admin/customization/clearance-sale`
2. Observe initial values load:
   - Font Family: "Arial"
   - Font Size: "13px"
   - Font Weight: "600"
   - Background Color: "#FFF1F2"
   - Text Color: "#991B1B"

**Expected Result:** All defaults are visible, live preview shows correct styling

---

### Test 2: Admin UI - Change Typography
**Steps:**
1. Change Font Family to "Georgia"
2. Change Font Size to "16px"
3. Change Font Weight to "Normal" (400)
4. Observe live preview updates

**Expected Result:**
- Live preview shows Georgia font
- Live preview shows 16px size
- Live preview shows 400 weight (normal)
- "Save changes" button becomes enabled

---

### Test 3: Admin UI - Change Colors
**Steps:**
1. Change Background Color to "#FF0000" (red)
2. Change Text Color to "#00FF00" (green)
3. Change Border Color to "#0000FF" (blue)
4. Observe live preview updates

**Expected Result:**
- Live preview has red background
- Live preview has green text
- Live preview has blue border
- All changes reflected immediately

---

### Test 4: Backend API - Save Configuration
**Steps:**
1. In Admin UI, make changes (e.g., Font Family → "Verdana")
2. Click "Save changes"
3. Observe success message
4. Check backend logs for POST to `/api/customization/clearance-sale`

**Expected Result:**
- Success toast appears: "Clearance Sale configuration saved successfully!"
- Save button disables
- Configuration persisted to MongoDB

---

### Test 5: Backend API - Load Configuration
**Steps:**
1. Refresh the admin page
2. Wait for config to load
3. Verify all previously saved values appear

**Expected Result:**
- Font Family shows "Verdana"
- All other saved values appear
- Loading state briefly appears, then resolves

---

### Test 6: Storefront API - Returns Latest Config
**Steps:**
1. Open browser dev tools (Network tab)
2. Visit storefront product page with clearance sale
3. Find request to `/apps/smart-stock/product-widget`
4. Check response JSON

**Expected Result:**
```json
{
  "clearanceConfig": {
    "fontFamily": "Verdana",
    "fontSize": "13px",
    "fontWeight": "600",
    "backgroundColor": "#FFF1F2",
    "textColor": "#991B1B",
    ...
  }
}
```

---

### Test 7: Liquid Template - CSS Variables Applied
**Steps:**
1. Visit storefront product page
2. Inspect clearance sale element in dev tools
3. Check computed styles

**Expected Result:**
- Element has CSS variables set:
  - `--smart-stock-clearance-font-family: Verdana`
  - `--smart-stock-clearance-font-size: 13px`
  - `--smart-stock-clearance-font-weight: 600`
  - `--smart-stock-clearance-bg: #FFF1F2`
  - `--smart-stock-clearance-text: #991B1B`
- Computed styles show these values applied

---

### Test 8: Storefront Widget - Displays Correct Styling
**Steps:**
1. Change Admin settings: Font Size → "18px"
2. Save changes
3. Refresh storefront product page
4. Observe clearance sale badge

**Expected Result:**
- Clearance sale widget displays with 18px font
- Styling matches admin preview
- Colors, font family, weight all correct

---

### Test 9: Shop Isolation
**Prerequisites:**
- Access to multiple Shopify stores (or simulate with different shop params)

**Steps:**
1. On Store A: Set Font Family → "Georgia"
2. On Store B: Set Font Family → "Courier"
3. Refresh Store A product page
4. Refresh Store B product page

**Expected Result:**
- Store A shows Georgia font
- Store B shows Courier font
- No cross-contamination of settings

---

### Test 10: Reset to Defaults
**Steps:**
1. In Admin UI, make changes (e.g., Font Family → "Times New Roman")
2. Click "Reset to defaults"
3. Confirm in modal
4. Observe values revert

**Expected Result:**
- All values return to defaults:
  - Font Family → "Arial"
  - Font Size → "13px"
  - Font Weight → "600"
  - Colors → original defaults
- Success message appears
- Storefront reflects default styling

---

### Test 11: Cache Freshness
**Steps:**
1. Change Font Size → "20px"
2. Save changes
3. Wait 5 seconds (ensure cache expired)
4. Open new storefront tab/window
5. Observe clearance sale widget

**Expected Result:**
- Widget shows 20px font (not cached value)
- No stale styling visible

---

### Test 12: Variant Change - Updates Widget
**Steps:**
1. Change Admin Font Weight → "700" (Bold)
2. Save changes
3. On storefront, change product variant
4. Observe variant change event

**Expected Result:**
- Widget refetches config
- Widget displays with 700 weight
- Styling updates immediately

---

## Troubleshooting

### Issue: Admin changes not appearing on storefront

**Checklist:**
- [ ] Verify POST request succeeded in admin
- [ ] Check MongoDB: Is ClearanceSaleConfig saved?
  ```javascript
  db.clearancesaleconfigs.find({ shopId: "..." })
  ```
- [ ] Verify Storefront API returns the config
  - Open `/apps/smart-stock/product-widget?shop=X` in browser
  - Check `clearanceConfig` in response
- [ ] Clear storefront cache/browser cache
- [ ] Refresh storefront page

### Issue: Storefront shows default styling

**Possible Causes:**
1. No saved config in MongoDB
2. Storefront API not returning config
3. Browser cache (hard refresh: Ctrl+Shift+R)
4. Liquid template not receiving response

**Debug Steps:**
```javascript
// In storefront console:
fetch('/apps/smart-stock/product-widget?shop=YOUR_SHOP').then(r => r.json()).then(d => console.log(d.clearanceConfig))
```

### Issue: CSS variables not applied

**Check:**
```javascript
// In storefront console, on clearance sale element:
const el = document.querySelector('.smart-stock-clearance-sale');
const styles = getComputedStyle(el);
console.log(styles.fontFamily);
console.log(styles.backgroundColor);
```

---

## Success Criteria ✓

The implementation is complete and working when:

1. ✓ Merchant changes Typography/Colors in Admin
2. ✓ Settings saved to MongoDB (per shop)
3. ✓ Admin preview matches saved values
4. ✓ Storefront API returns saved settings
5. ✓ Liquid template applies CSS variables
6. ✓ Embed.js applies inline styles
7. ✓ Widget displays merchant's custom styling
8. ✓ Refreshing storefront keeps custom styling
9. ✓ Each shop has isolated settings
10. ✓ Defaults used when no custom config exists

---

## Configuration Files

### App Proxy Configuration
File: `shopify.app.toml`
```toml
[app_proxy]
url = "https://.../api/storefront"
subpath = "smart-stock"
prefix = "apps"
```
Maps: `/apps/smart-stock/*` → `https://.../api/storefront/*`

### Default Config
File: `backend/controllers/customizationController.js`
```javascript
const DEFAULT_CONFIG = {
  fontFamily: "Arial",
  fontSize: "13px",
  fontWeight: "600",
  backgroundColor: "#FFF1F2",
  textColor: "#991B1B",
  borderColor: "#FECACA",
  ...
};
```

---

## Monitoring

### Logs to Check

**Backend:**
```bash
# Watch for customization controller logs
tail -f backend/logs/app.log | grep -i "clearance\|customization"
```

**Admin Console:**
```javascript
// Check API calls
fetch('GET', '/api/customization/clearance-sale?shop=...').then(...)
```

**Storefront Console:**
```javascript
// Check storefront API calls
fetch('/apps/smart-stock/product-widget?shop=...').then(r => r.json()).then(d => d.clearanceConfig)
```

---

## Performance Notes

- **API Response**: Typically < 100ms (DB query + merge)
- **Cache Policy**: `no-store, no-cache` (fresh data every request)
- **CSS Variables**: Zero performance impact (browser native)
- **Inline Styles**: Applied once on widget load
