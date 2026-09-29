# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shoppersdeals.spec.js >> ShoppersDeals E2E Website Tests >> Category navigation should update URL
- Location: tests/shoppersdeals.spec.js:29:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "home"
Received string:    "http://localhost:3020/?category=fashion"
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - banner [ref=e2]:
    - paragraph [ref=e5]: ⚡ LIVE DEALS · Amazon · Flipkart · Myntra — refreshed every few seconds
    - generic [ref=e8]:
      - link "ShoppersDeals Logo ShoppersDeals" [ref=e9] [cursor=pointer]:
        - /url: /
        - img "ShoppersDeals Logo" [ref=e10]
        - generic [ref=e11]: ShoppersDeals
      - navigation "Primary" [ref=e12]:
        - link "Live Feed" [ref=e13] [cursor=pointer]:
          - /url: /
        - link "Hot Deals" [ref=e15] [cursor=pointer]:
          - /url: /hot
        - link "Track Prices" [ref=e16] [cursor=pointer]:
          - /url: /products
        - link "Categories" [ref=e17] [cursor=pointer]:
          - /url: /categories
      - searchbox "Search deals" [ref=e22]
      - generic [ref=e23]:
        - link "Wishlist" [ref=e24] [cursor=pointer]:
          - /url: /saved
        - link "Sign In" [ref=e29] [cursor=pointer]:
          - /url: /profile
    - generic [ref=e36]:
      - link "🔥 Live Deals" [ref=e37] [cursor=pointer]:
        - /url: /
        - generic [ref=e38]: 🔥
        - generic [ref=e39]: Live Deals
      - link "📱 Mobiles & Tech" [ref=e40] [cursor=pointer]:
        - /url: /?category=electronics
        - generic [ref=e41]: 📱
        - generic [ref=e42]: Mobiles & Tech
      - link "👗 Fashion Loot" [ref=e43] [cursor=pointer]:
        - /url: /?category=fashion
        - generic [ref=e44]: 👗
        - generic [ref=e45]: Fashion Loot
      - link "🏠 Home & Kitchen" [active] [ref=e46] [cursor=pointer]:
        - /url: /?category=home
        - generic [ref=e47]: 🏠
        - generic [ref=e48]: Home & Kitchen
      - link "💄 Beauty & Care" [ref=e49] [cursor=pointer]:
        - /url: /?category=beauty
        - generic [ref=e50]: 💄
        - generic [ref=e51]: Beauty & Care
      - link "⚡ 50%+ Drops" [ref=e52] [cursor=pointer]:
        - /url: /hot
        - generic [ref=e53]: ⚡
        - generic [ref=e54]: 50%+ Drops
      - link "📊 Price Tracker" [ref=e55] [cursor=pointer]:
        - /url: /products
        - generic [ref=e56]: 📊
        - generic [ref=e57]: Price Tracker
      - link "❤️ Wishlist & Alerts" [ref=e58] [cursor=pointer]:
        - /url: /saved
        - generic [ref=e59]: ❤️
        - generic [ref=e60]: Wishlist & Alerts
  - main [ref=e61]:
    - generic [ref=e62]:
      - generic [ref=e63]:
        - generic [ref=e66]:
          - img "ShoppersDeals AI Shopping Robot Assistant" [ref=e67]
          - generic [ref=e68]:
            - generic [ref=e69]: 🤖 AI Deal Scanner & Price Tracker
            - generic [ref=e70]: LIVE 24/7
        - generic [ref=e74]:
          - generic [ref=e75]:
            - generic [ref=e76]:
              - generic [ref=e77]: ⚡
              - text: Price History & AI Deal Scanner
            - heading "Compare prices, scan fake discounts & track 100+ stores" [level=1] [ref=e78]
            - paragraph [ref=e79]: Save instantly, everytime you shop!
          - generic [ref=e81]:
            - textbox "Search products or paste any Amazon / Flipkart / Myntra link..." [ref=e86]
            - button "Track & Scan ⚡" [ref=e87]
          - generic [ref=e89]:
            - generic [ref=e90]: "Instant Samples:"
            - button "Apple iPhone (96% Trust)" [ref=e91]
            - button "Sony WH-1000XM5 (92% Trust)" [ref=e92]
            - button "OnePlus Nord (84% Trust)" [ref=e93]
            - button "Nike Revolution (94% Trust)" [ref=e94]
          - generic [ref=e95]:
            - generic [ref=e97]:
              - generic [ref=e101]: 10M+
              - text: Smart Shoppers
            - generic [ref=e103]:
              - generic [ref=e107]: ₹200Cr+
              - text: Saved so far
            - generic [ref=e109]:
              - generic [ref=e113]: 4.8/5
              - text: User Rating
      - generic [ref=e115]:
        - generic [ref=e116]:
          - generic [ref=e117]:
            - heading "Top Stores Tracked" [level=2] [ref=e118]
            - paragraph [ref=e119]: Explore live price drops & verified promo codes by store
          - link "View All Stores →" [ref=e120] [cursor=pointer]:
            - /url: /categories
        - generic [ref=e121]:
          - link "🛍️ Live Amazon India Great Indian Festival & Lightning Deals 🔥 Up to 80% Off" [ref=e122] [cursor=pointer]:
            - /url: /?merchant=amazon
            - generic [ref=e123]:
              - generic [ref=e124]:
                - generic [ref=e125]: 🛍️
                - generic [ref=e126]: Live
              - heading "Amazon India" [level=3] [ref=e127]
              - paragraph [ref=e128]: Great Indian Festival & Lightning Deals
            - generic [ref=e129]: 🔥 Up to 80% Off
          - link "⚡ Live Flipkart Big Billion Days & SuperCoin Drops ⚡ Extra Bank Discounts" [ref=e131] [cursor=pointer]:
            - /url: /?merchant=flipkart
            - generic [ref=e132]:
              - generic [ref=e133]:
                - generic [ref=e134]: ⚡
                - generic [ref=e135]: Live
              - heading "Flipkart" [level=3] [ref=e136]
              - paragraph [ref=e137]: Big Billion Days & SuperCoin Drops
            - generic [ref=e138]: ⚡ Extra Bank Discounts
          - link "👗 Live Myntra Fashion, Footwear & Designer Loot 👗 50-80% Off Brands" [ref=e140] [cursor=pointer]:
            - /url: /?merchant=myntra
            - generic [ref=e141]:
              - generic [ref=e142]:
                - generic [ref=e143]: 👗
                - generic [ref=e144]: Live
              - heading "Myntra" [level=3] [ref=e145]
              - paragraph [ref=e146]: Fashion, Footwear & Designer Loot
            - generic [ref=e147]: 👗 50-80% Off Brands
          - link "💄 Live Nykaa Beauty, Skincare & Luxury Cosmetics 💄 Free Gifts & Combos" [ref=e149] [cursor=pointer]:
            - /url: /?merchant=nykaa
            - generic [ref=e150]:
              - generic [ref=e151]:
                - generic [ref=e152]: 💄
                - generic [ref=e153]: Live
              - heading "Nykaa" [level=3] [ref=e154]
              - paragraph [ref=e155]: Beauty, Skincare & Luxury Cosmetics
            - generic [ref=e156]: 💄 Free Gifts & Combos
          - link "🕶️ Live Ajio Trends, Sneakers & Premium Streetwear 🏷️ Flat ₹500 Off Coupons" [ref=e158] [cursor=pointer]:
            - /url: /?merchant=ajio
            - generic [ref=e159]:
              - generic [ref=e160]:
                - generic [ref=e161]: 🕶️
                - generic [ref=e162]: Live
              - heading "Ajio" [level=3] [ref=e163]
              - paragraph [ref=e164]: Trends, Sneakers & Premium Streetwear
            - generic [ref=e165]: 🏷️ Flat ₹500 Off Coupons
          - link "🎁 Live Shopsy Budget Shopping & Under ₹99 Deals 💰 Lowest Price Guaranteed" [ref=e167] [cursor=pointer]:
            - /url: /?merchant=shopsy
            - generic [ref=e168]:
              - generic [ref=e169]:
                - generic [ref=e170]: 🎁
                - generic [ref=e171]: Live
              - heading "Shopsy" [level=3] [ref=e172]
              - paragraph [ref=e173]: Budget Shopping & Under ₹99 Deals
            - generic [ref=e174]: 💰 Lowest Price Guaranteed
      - generic [ref=e176]:
        - generic [ref=e177]:
          - generic [ref=e178]:
            - text: Curated Collections
            - heading "Shop By Top Categories" [level=2] [ref=e179]
            - paragraph [ref=e180]: Browse India's lowest prices and active price drops by product category
          - link "View All Categories →" [ref=e181] [cursor=pointer]:
            - /url: /categories
        - generic [ref=e182]:
          - generic [ref=e183]:
            - generic [ref=e184]:
              - link "Smartphones & Tech 240+ Deals" [ref=e185] [cursor=pointer]:
                - /url: /?category=electronics&q=phone
                - img "Smartphones & Tech" [ref=e186]
                - generic [ref=e187]: 240+ Deals
              - link [ref=e188] [cursor=pointer]:
                - /url: /?category=electronics&q=phone
                - heading "Smartphones & Tech" [level=3] [ref=e189]
              - paragraph [ref=e190]: Apple iPhone, Samsung, OnePlus, Redmi 5G
            - generic [ref=e191]:
              - generic [ref=e192]: "Popular Ranges:"
              - generic [ref=e193]:
                - link "Under ₹15,000" [ref=e194] [cursor=pointer]:
                  - /url: /?category=electronics&q=smartphone
                - link "Under ₹25,000" [ref=e195] [cursor=pointer]:
                  - /url: /?category=electronics&q=phone
                - link "🔥 Flagship 5G" [ref=e196] [cursor=pointer]:
                  - /url: /?category=electronics&q=5g
          - generic [ref=e197]:
            - generic [ref=e198]:
              - link "Fashion & Sneakers 500+ Deals" [ref=e199] [cursor=pointer]:
                - /url: /?category=fashion
                - img "Fashion & Sneakers" [ref=e200]
                - generic [ref=e201]: 500+ Deals
              - link [ref=e202] [cursor=pointer]:
                - /url: /?category=fashion
                - heading "Fashion & Sneakers" [level=3] [ref=e203]
              - paragraph [ref=e204]: Trendy Sneakers, Handbags, Watches, Apparel
            - generic [ref=e205]:
              - generic [ref=e206]: "Popular Ranges:"
              - generic [ref=e207]:
                - link "Min 60% Off" [ref=e208] [cursor=pointer]:
                  - /url: /?category=fashion
                - link "Under ₹499 Store" [ref=e209] [cursor=pointer]:
                  - /url: /?category=fashion&q=tshirt
                - link "👟 Top Sneakers" [ref=e210] [cursor=pointer]:
                  - /url: /?category=fashion&q=shoes
          - generic [ref=e211]:
            - generic [ref=e212]:
              - link "Home & Kitchen 210+ Deals" [ref=e213] [cursor=pointer]:
                - /url: /?category=home
                - img "Home & Kitchen" [ref=e214]
                - generic [ref=e215]: 210+ Deals
              - link [ref=e216] [cursor=pointer]:
                - /url: /?category=home
                - heading "Home & Kitchen" [level=3] [ref=e217]
              - paragraph [ref=e218]: Air Fryers, Espresso Machines, Robot Vacuums
            - generic [ref=e219]:
              - generic [ref=e220]: "Popular Ranges:"
              - generic [ref=e221]:
                - link "Air Fryers & Ovens" [ref=e222] [cursor=pointer]:
                  - /url: /?category=home&q=fryer
                - link "Under ₹999 Kitchen" [ref=e223] [cursor=pointer]:
                  - /url: /?category=home
                - link "Water Purifiers" [ref=e224] [cursor=pointer]:
                  - /url: /?category=home&q=purifier
          - generic [ref=e225]:
            - generic [ref=e226]:
              - link "Beauty & Skincare 175+ Deals" [ref=e227] [cursor=pointer]:
                - /url: /?category=beauty
                - img "Beauty & Skincare" [ref=e228]
                - generic [ref=e229]: 175+ Deals
              - link [ref=e230] [cursor=pointer]:
                - /url: /?category=beauty
                - heading "Beauty & Skincare" [level=3] [ref=e231]
              - paragraph [ref=e232]: Glow Serums, Matte Lipsticks, Perfumes
            - generic [ref=e233]:
              - generic [ref=e234]: "Popular Ranges:"
              - generic [ref=e235]:
                - link "Under ₹399" [ref=e236] [cursor=pointer]:
                  - /url: /?category=beauty
                - link "🧴 Skincare Combos" [ref=e237] [cursor=pointer]:
                  - /url: /?category=beauty&q=serum
                - link "Perfumes & Deos" [ref=e238] [cursor=pointer]:
                  - /url: /?category=beauty&q=perfume
      - generic [ref=e240]:
        - button "All" [ref=e241]
        - button "Electronics" [ref=e242]
        - button "Men's Fashion" [ref=e243]
        - button "Women's Fashion" [ref=e244]
        - button "Fitness" [ref=e245]
        - button "Home" [ref=e246]
        - button "Beauty" [ref=e247]
        - button "Recharge" [ref=e248]
        - button "Books" [ref=e249]
        - button "General" [ref=e250]
        - button "All Stores" [ref=e252]
        - button [ref=e254]:
          - img "Amazon" [ref=e255]
        - button [ref=e256]:
          - img "Flipkart" [ref=e257]
        - button [ref=e258]:
          - img "Myntra" [ref=e259]
        - button "Meesho" [ref=e260]
      - generic [ref=e262]:
        - heading "No Deals Found" [level=2] [ref=e263]
        - paragraph [ref=e264]: Try clearing filters or check back in a few seconds as new live deals arrive.
      - generic [ref=e265]:
        - generic [ref=e266]:
          - generic [ref=e267]:
            - generic [ref=e268]: ⚡
            - text: Superior Shopping Intelligence
          - heading "Why Over 100,000+ Shoppers Trust ShoppersDeals" [level=2] [ref=e269]
          - paragraph [ref=e270]: Everything you need to make confident, money-saving purchasing decisions.
        - generic [ref=e271]:
          - generic [ref=e273]:
            - generic [ref=e274]:
              - generic [ref=e275]: 🛡️
              - generic [ref=e276]: AI Powered
            - heading "Fake Sale Detection" [level=3] [ref=e277]
            - paragraph [ref=e278]: Sellers often double MRP right before big sales. Our AI compares real historical prices to tell you if a discount is genuine or fake.
          - generic [ref=e280]:
            - generic [ref=e281]:
              - generic [ref=e282]: 📊
              - generic [ref=e283]: 100% Accurate
            - heading "3-Month Price Graph" [level=3] [ref=e284]
            - paragraph [ref=e285]: Visualize every price change across Amazon, Flipkart, and Myntra. See all-time low records and know the exact right time to buy.
          - generic [ref=e287]:
            - generic [ref=e288]:
              - generic [ref=e289]: 🔔
              - generic [ref=e290]: Free Forever
            - heading "Instant Price Alerts" [level=3] [ref=e291]
            - paragraph [ref=e292]: Set your dream price on any product. When the price crashes, we instantly alert you via WhatsApp, Telegram, or Email.
          - generic [ref=e294]:
            - generic [ref=e295]:
              - generic [ref=e296]: 🏷️
              - generic [ref=e297]: Auto Updated
            - heading "Verified Coupons" [level=3] [ref=e298]
            - paragraph [ref=e299]: Never search for discount codes again. Get verified promo codes, bank cashback offers, and lightning deal coupons in one place.
      - generic [ref=e300]:
        - generic [ref=e301]:
          - generic [ref=e302]:
            - generic [ref=e303]: 💡
            - text: Smart Shopping Simplified
          - heading "How ShoppersDeals Saves You Money" [level=2] [ref=e304]
          - paragraph [ref=e305]: Never overpay during flash sales again with India's most accurate price tracking assistant.
        - generic [ref=e306]:
          - generic [ref=e307]:
            - generic [ref=e308]:
              - generic [ref=e309]:
                - generic [ref=e310]: 🔗
                - generic [ref=e311]: "01"
              - heading "Paste Any Store Link or Search" [level=3] [ref=e312]
              - paragraph [ref=e313]: Copy any product URL from Amazon, Flipkart, Myntra, Nykaa, or Ajio and paste it into our search bar.
            - generic [ref=e315]:
              - generic [ref=e316]: ✓
              - text: Works across 100+ stores
          - generic [ref=e317]:
            - generic [ref=e318]:
              - generic [ref=e319]:
                - generic [ref=e320]: 📊
                - generic [ref=e321]: "02"
              - heading "Check 90-Day Price History" [level=3] [ref=e322]
              - paragraph [ref=e323]: See the highest, lowest, and average price history to know if a sale is genuinely discounted or an inflated MRP trick.
            - generic [ref=e325]:
              - generic [ref=e326]: ✓
              - text: Instant AI Verdict
          - generic [ref=e327]:
            - generic [ref=e328]:
              - generic [ref=e329]:
                - generic [ref=e330]: 🔔
                - generic [ref=e331]: "03"
              - heading "Get Free Price Drop Alerts" [level=3] [ref=e332]
              - paragraph [ref=e333]: Set your target price. Our 24/7 trackers will ping you on WhatsApp or Email the moment the price falls.
            - generic [ref=e335]:
              - generic [ref=e336]: ✓
              - text: Real-time Notifications
      - generic [ref=e338]:
        - generic [ref=e339]:
          - generic [ref=e340]:
            - generic [ref=e341]: ✨
            - text: Browser Extension & App
          - heading "Never Miss a Price Drop While You Browse" [level=2] [ref=e342]
          - paragraph [ref=e343]: Install the free ShoppersDeals extension. Whenever you visit Amazon or Flipkart, the 90-day price history graph and coupon auto-apply bar will appear right on the product page!
          - generic [ref=e344]:
            - link "🌐 Add to Chrome — It's Free" [ref=e345] [cursor=pointer]:
              - /url: https://chromewebstore.google.com
              - generic [ref=e346]: 🌐
              - text: Add to Chrome — It's Free
            - link "📱 Get Android App" [ref=e347] [cursor=pointer]:
              - /url: /support
              - generic [ref=e348]: 📱
              - text: Get Android App
          - generic [ref=e349]:
            - generic [ref=e350]: ⭐ 4.8 Rating
            - generic [ref=e351]: •
            - generic [ref=e352]: 🔒 100% Safe & Private
            - generic [ref=e353]: •
            - generic [ref=e354]: ⚡ Zero Slowdown
        - generic [ref=e355]:
          - img "ShoppersDeals Chrome Extension Live Price History Graph" [ref=e356]
          - generic [ref=e357]:
            - generic [ref=e358]: Smart Price Assistant
            - generic [ref=e359]: ✓ Active on Amazon & FK
  - contentinfo [ref=e360]:
    - generic [ref=e362]:
      - heading "How We Curate the Best Deals of the Day" [level=2] [ref=e363]
      - paragraph [ref=e364]: Most deal platforms work the same way - they pull data from an API, put a "SALE" badge on it, and call it a day. That's not how ShoppersDeals operates.
      - paragraph [ref=e365]: Our deals of the day go through a two-layer verification process before they ever appear on this page. First, our proprietary price-tracking system - the same engine that monitors price drops in real-time - continuously monitors product prices across major platforms, including Amazon, Flipkart, Myntra, Ajio, and more. The system flags a product only when its current price drops meaningfully below its historical average, not just a marginal dip that barely moves the needle.
      - paragraph [ref=e366]: "But data alone isn't enough. Our team at ShoppersDeals manually reviews every flagged deal to verify three things: whether the discount is genuine and not an inflated MRP trick, whether the product is actually in stock at the time of listing, and whether the savings hold up against both the 30-day and 90-day average price - not just what it cost yesterday."
      - paragraph [ref=e367]: We also cross-reference with our AI engines and partner deal data to identify where additional savings can be stacked on top of the listed price. This combination of algorithmic tracking and human verification is what separates ShoppersDeals's daily deals from the noise you'll find on every other platform.
      - paragraph [ref=e368]: "The result is straightforward: every deal on this page represents a verified, real-time price drop backed by original price research - not a sponsored listing or a promotional badge a brand paid to place here. When we say it's a deal, we've done the homework to prove it."
      - heading "Smart Shopping Guide - Get the Most Out of Daily Deals" [level=3] [ref=e369]
      - paragraph [ref=e370]: Online shopping involves real financial decisions. And in a market flooded with sale banners and discount badges, knowing how to separate a genuine deal from a marketing gimmick is one of the most valuable skills a shopper can have. Here's what you need to know before hitting "Buy Now."
      - heading "How to Identify Deceptive Discounts" [level=4] [ref=e371]
      - paragraph [ref=e372]: Not every "70% off" is what it looks like. A well-documented pattern across Indian e-commerce platforms involves inflating a product's MRP before a sale window and then "discounting" it back to its original price. The percentage looks impressive. The actual saving is zero.
      - paragraph [ref=e373]: "Here's how to call the bluff every single time:"
      - list [ref=e374]:
        - listitem [ref=e375]: • Check the price history graph before buying. If a product has been sitting at the "discounted" price for months, it was never really on sale.
        - listitem [ref=e376]: • Compare the current price against the 90-day average, not just what it cost yesterday.
        - listitem [ref=e377]: • Be skeptical of deals that appear exclusively during major sale events with suspiciously round discount figures, "originally ₹9,999, now ₹4,999" is a classic pattern.
        - listitem [ref=e378]: • Look for products where the price has genuinely dropped below its historical floor, that's where real, actionable savings exist.
      - heading "Why Daily Deals Expire Fast - And How to Secure Them" [level=4] [ref=e379]
      - paragraph [ref=e380]: Genuine price drops attract demand quickly. When a product hits its lowest recorded price, stock clears fast - often within a few hours of the deal going live. This isn't artificial scarcity; it's what happens when a real deal reaches a deal-aware audience.
      - paragraph [ref=e381]: "Here's how to stay consistently ahead:"
      - list [ref=e382]:
        - listitem [ref=e383]: • Check our live feed regularly. You'll get notified the moment the price falls to your target.
        - listitem [ref=e384]: • Don't add to the wishlist and wait to act when the alert arrives. Genuine deals don't wait for you.
        - listitem [ref=e385]: • Check the deals page early morning, many price drops go live between midnight and 8 AM IST, before broader traffic arrives.
        - listitem [ref=e386]: • Always verify stock availability before spending time comparing bank offers or cashback stacking options.
      - heading "Category-Wise Deal Breakdown - Where the Real Savings Are" [level=3] [ref=e387]
      - paragraph [ref=e388]: Different product categories behave very differently in pricing patterns, discount cycles, and the depth of genuine savings available. Here's how ShoppersDeals approaches each major category on the deals page - and what you should keep in mind when shopping each one.
      - list [ref=e389]:
        - listitem [ref=e390]:
          - strong [ref=e391]: "Electronics:"
          - text: Price tracking delivers the highest return here. Smartphone prices, for instance, tend to drop sharply 2-3 months after a launch as inventory builds and newer models enter the pipeline. In the electronics category, ShoppersDeals prioritizes deals offering at least 20% genuine savings compared to the 3-month average price. For high-value items like laptops, smart TVs, and audio equipment, even a 10-15% real price drop translates to thousands of rupees in actual savings - especially when stacked with a bank offer.
        - listitem [ref=e392]:
          - strong [ref=e393]: "Fashion and Accessories:"
          - text: Fashion pricing is volatile and moves fast. Discounts on clothing and footwear can swing dramatically within the same week, depending on inventory levels and platform promotions. In this category, we focus on deals where the current price sits below the 30-day average with verified stock. End-of-season clearance events typically offer the deepest and most legitimate cuts in fashion - those get flagged and highlighted prominently on the deals page as they appear.
        - listitem [ref=e394]:
          - strong [ref=e395]: "Home Essentials & Appliances:"
          - text: Home appliances - air coolers, water purifiers, kitchen gadgets, and storage solutions - tend to see their best prices during festive season sales. Outside of major sale windows, genuine deals in this category are less frequent but more significant when they appear. ShoppersDeals tracks these products daily and flags deals only when the price crosses below its historical floor, not just a marginal dip.
        - listitem [ref=e396]:
          - strong [ref=e397]: "Grooming & Personal Care:"
          - text: FMCG and personal care products rotate quickly, and deals in this category are best evaluated on a per-unit-price basis. Combo packs and bundle offers often deliver more mathematical value than single-product discounts. ShoppersDeals tracks unit pricing across pack sizes so that the "deal" you see is one that actually makes economic sense - not just one that looks large on the label.
      - 'heading "Average Savings Comparison: Regular Shopping vs. Daily Deals" [level=3] [ref=e398]'
      - paragraph [ref=e399]: "Here's a data-backed breakdown of what verified daily deals on ShoppersDeals deliver compared to standard untracked online shopping:"
      - table [ref=e401]:
        - rowgroup [ref=e402]:
          - row [ref=e403]:
            - columnheader "Savings Factor" [ref=e404]
            - columnheader "Regular Shopping" [ref=e405]
            - columnheader "Daily Deals (ShoppersDeals Verified)" [ref=e406]
        - rowgroup [ref=e407]:
          - row [ref=e408]:
            - cell "Avg. Discount on Electronics" [ref=e409]
            - cell "5 - 10%" [ref=e410]
            - cell "20 - 40%" [ref=e411]
          - row [ref=e412]:
            - cell "Price Verification" [ref=e413]
            - cell "None" [ref=e414]
            - cell "Cross-checked via price history" [ref=e415]
          - row [ref=e416]:
            - cell "Bank Offers" [ref=e417]
            - cell "Not tracked" [ref=e418]
            - cell "Stackable tracked" [ref=e419]
          - row [ref=e420]:
            - cell "Price History Check" [ref=e421]
            - cell "Manual effort" [ref=e422]
            - cell "Automated via ShoppersDeals AI" [ref=e423]
          - row [ref=e424]:
            - cell "Deal Authenticity" [ref=e425]
            - cell "Unverified" [ref=e426]
            - cell "Manually reviewed" [ref=e427]
          - row [ref=e428]:
            - cell "Stock Availability Check" [ref=e429]
            - cell "No" [ref=e430]
            - cell "Yes - real-time" [ref=e431]
      - paragraph [ref=e432]: Savings estimates based on ShoppersDeals historical price tracking data across Amazon, Flipkart, and partner platforms.
      - heading "Frequently Asked Questions" [level=3] [ref=e433]
      - paragraph [ref=e434]: We heard you. Get reliable, verified answers here.
      - list [ref=e435]:
        - listitem [ref=e436]:
          - strong [ref=e437]: How frequently are deals updated?
          - text: Deals are updated in real-time. Our AI engine scans deals 24/7 and updates the feed instantly.
        - listitem [ref=e438]:
          - strong [ref=e439]: Are the deals verified?
          - text: Yes. Every deal goes through an automated price-history check and a manual review to ensure it's a genuine price drop.
    - generic [ref=e440]:
      - generic [ref=e441]:
        - heading "ShoppersDeals" [level=2] [ref=e442]
        - paragraph [ref=e443]: ShoppersDeals is India's premier live deal tracking platform. We scan Amazon, Flipkart, and Myntra 24/7 to bring you the biggest discounts, lightning deals, and price drops on smartphones, laptops, and fashion before they expire.
      - generic [ref=e444]:
        - heading "Explore" [level=3] [ref=e445]
        - list [ref=e446]:
          - listitem [ref=e447]:
            - link "Live Feed" [ref=e448] [cursor=pointer]:
              - /url: /
          - listitem [ref=e449]:
            - link "Hot Deals 🔥" [ref=e450] [cursor=pointer]:
              - /url: /hot
          - listitem [ref=e451]:
            - link "Shopping Guides" [ref=e452] [cursor=pointer]:
              - /url: /blog
          - listitem [ref=e453]:
            - link "Browse Categories" [ref=e454] [cursor=pointer]:
              - /url: /categories
      - generic [ref=e455]:
        - heading "Legal" [level=3] [ref=e456]
        - list [ref=e457]:
          - listitem [ref=e458]:
            - link "Privacy Policy" [ref=e459] [cursor=pointer]:
              - /url: /privacy
          - listitem [ref=e460]:
            - link "Delete Your Account" [ref=e461] [cursor=pointer]:
              - /url: /delete-account
          - listitem [ref=e462]:
            - link "Affiliate Disclosure" [ref=e463] [cursor=pointer]:
              - /url: /affiliate-disclosure
          - listitem [ref=e464]: Terms of Service
          - listitem [ref=e465]:
            - link "Support" [ref=e466] [cursor=pointer]:
              - /url: /support
    - paragraph [ref=e468]: © 2026 ShoppersDeals. All rights reserved. As an Amazon Associate we earn from qualifying purchases.
  - button "Open Next.js Dev Tools" [ref=e474] [cursor=pointer]:
    - generic [ref=e477]:
      - text: Rendering
      - generic [ref=e478]:
        - generic [ref=e479]: .
        - generic [ref=e480]: .
        - generic [ref=e481]: .
  - alert [ref=e482]: Compare prices, scan fake discounts & track 100+ stores
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('ShoppersDeals E2E Website Tests', () => {
  4   |   
  5   |   test.beforeEach(async ({ page }) => {
  6   |     // Navigate to homepage before each test
  7   |     await page.goto('/', { waitUntil: 'load', timeout: 30000 });
  8   |   });
  9   | 
  10  |   test('Homepage elements should render correctly', async ({ page }) => {
  11  |     // Check page title
  12  |     await expect(page).toHaveTitle(/ShoppersDeals/);
  13  | 
  14  |     // Check if the logo is present
  15  |     const logo = page.locator('img[alt*="Logo"], img[alt*="logo"]').first();
  16  |     await expect(logo).toBeVisible();
  17  | 
  18  |     // Check if the page contains deals/product cards
  19  |     const dealCards = page.locator('article, .sd-grid-card, [class*="card"]');
  20  |     const cardCount = await dealCards.count();
  21  |     console.log(`[Test] Total deal cards rendered: ${cardCount}`);
  22  |     expect(cardCount).toBeGreaterThan(0);
  23  | 
  24  |     // Check header/navigation controls
  25  |     const searchBar = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]').first();
  26  |     await expect(searchBar).toBeVisible();
  27  |   });
  28  | 
  29  |   test('Category navigation should update URL', async ({ page }) => {
  30  |     const categories = ['Electronics', 'Fashion', 'Home', 'Beauty'];
  31  |     
  32  |     for (const cat of categories) {
  33  |       // Find category link/button
  34  |       const catBtn = page.locator(`a:has-text("${cat}"), button:has-text("${cat}")`).first();
  35  |       
  36  |       if (await catBtn.count() > 0) {
  37  |         await catBtn.click();
  38  |         await page.waitForTimeout(1000);
  39  |         
  40  |         // Assert that the URL query param contains the category name or filters it
  41  |         const currentUrl = page.url();
  42  |         console.log(`[Test] Navigated to category ${cat}: ${currentUrl}`);
  43  |         
  44  |         if (cat === 'Fashion') {
  45  |           // Fashion tab might link to men-fashion or women-fashion
  46  |           expect(currentUrl).toContain('fashion');
  47  |         } else {
> 48  |           expect(currentUrl.toLowerCase()).toContain(cat.toLowerCase());
      |                                            ^ Error: expect(received).toContain(expected) // indexOf
  49  |         }
  50  |       }
  51  |     }
  52  |   });
  53  | 
  54  |   test('Search input should return filtered items', async ({ page }) => {
  55  |     const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]').first();
  56  |     await expect(searchInput).toBeVisible();
  57  |     
  58  |     // Type search query
  59  |     await searchInput.fill('laptop');
  60  |     await page.keyboard.press('Enter');
  61  |     await page.waitForTimeout(3000);
  62  | 
  63  |     // Assert URL has the query parameter
  64  |     expect(page.url()).toContain('q=laptop');
  65  | 
  66  |     // Verify search result cards are displayed
  67  |     const cards = page.locator('article, .sd-grid-card, [class*="card"]');
  68  |     expect(await cards.count()).toBeGreaterThan(0);
  69  |   });
  70  | 
  71  |   test('Deal detail navigation should resolve and load detail view', async ({ page }) => {
  72  |     // Find first /deal/ link on the home feed
  73  |     const dealLink = page.locator('a[href*="/deal/"]').first();
  74  |     
  75  |     if (await dealLink.count() > 0) {
  76  |       const dealUrl = await dealLink.getAttribute('href');
  77  |       console.log(`[Test] Tapping deal card: ${dealUrl}`);
  78  |       
  79  |       await dealLink.click();
  80  |       await page.waitForLoadState('load');
  81  |       await page.waitForTimeout(2000);
  82  | 
  83  |       // Verify page loads successfully without a 404 or crash
  84  |       const currentUrl = page.url();
  85  |       expect(currentUrl).not.toContain('404');
  86  |       
  87  |       // Should redirect to a canonical product page if matched, or stay on deal page
  88  |       expect(currentUrl).toMatch(/\/product\/|\/deal\//);
  89  | 
  90  |       // Verify product detail features
  91  |       const buyButton = page.locator('a:has-text("Get Deal"), a:has-text("View on")').first();
  92  |       await expect(buyButton).toBeVisible();
  93  |       
  94  |       // Price History table/chart check
  95  |       const priceHistoryHeader = page.locator(':has-text("Price History"), :has-text("Price Trend")').first();
  96  |       await expect(priceHistoryHeader).toBeVisible();
  97  |     } else {
  98  |       console.log('[Test] No deal links found on homepage to click.');
  99  |     }
  100 |   });
  101 | 
  102 |   test('Static utility pages should load correctly', async ({ page }) => {
  103 |     const pages = ['/privacy', '/affiliate-disclosure'];
  104 |     
  105 |     for (const p of pages) {
  106 |       const response = await page.goto(p);
  107 |       expect(response.status()).toBe(200);
  108 | 
  109 |       const mainHeading = page.locator('h1, h2').first();
  110 |       await expect(mainHeading).toBeVisible();
  111 |       
  112 |       const bodyText = await page.locator('body').textContent();
  113 |       expect(bodyText.length).toBeGreaterThan(500);
  114 |     }
  115 |   });
  116 | 
  117 | });
  118 | 
```