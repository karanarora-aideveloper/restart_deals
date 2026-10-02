import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SeoFooterContent() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="heading" aria-level={2} style={styles.h2}>How We Curate the Best Deals of the Day</Text>
      <Text style={styles.paragraph}>
        Most deal platforms work the same way - they pull data from an API, put a "SALE" badge on it, and call it a day. That's not how ShoppersDeals operates.
      </Text>
      <Text style={styles.paragraph}>
        Our deals of the day go through a two-layer verification process before they ever appear on this page. First, our proprietary price-tracking system - the same engine that monitors price drops in real-time - continuously monitors product prices across major platforms, including Amazon, Flipkart, Myntra, Ajio, and more. The system flags a product only when its current price drops meaningfully below its historical average, not just a marginal dip that barely moves the needle.
      </Text>
      <Text style={styles.paragraph}>
        But data alone isn't enough. Our team at ShoppersDeals manually reviews every flagged deal to verify three things: whether the discount is genuine and not an inflated MRP trick, whether the product is actually in stock at the time of listing, and whether the savings hold up against both the 30-day and 90-day average price - not just what it cost yesterday.
      </Text>
      <Text style={styles.paragraph}>
        We also cross-reference with our AI engines and partner deal data to identify where additional savings can be stacked on top of the listed price. This combination of algorithmic tracking and human verification is what separates ShoppersDeals's daily deals from the noise you'll find on every other platform.
      </Text>
      <Text style={styles.paragraph}>
        The result is straightforward: every deal on this page represents a verified, real-time price drop backed by original price research - not a sponsored listing or a promotional badge a brand paid to place here. When we say it's a deal, we've done the homework to prove it.
      </Text>

      <Text accessibilityRole="heading" aria-level={3} style={styles.h3}>Smart Shopping Guide - Get the Most Out of Daily Deals</Text>
      <Text style={styles.paragraph}>
        Online shopping involves real financial decisions. And in a market flooded with sale banners and discount badges, knowing how to separate a genuine deal from a marketing gimmick is one of the most valuable skills a shopper can have. Here's what you need to know before hitting "Buy Now."
      </Text>

      <Text accessibilityRole="heading" aria-level={4} style={styles.h4}>How to Identify Deceptive Discounts</Text>
      <Text style={styles.paragraph}>
        Not every "70% off" is what it looks like. A well-documented pattern across Indian e-commerce platforms involves inflating a product's MRP before a sale window and then "discounting" it back to its original price. The percentage looks impressive. The actual saving is zero.
      </Text>
      <Text style={styles.paragraph}>Here's how to call the bluff every single time:</Text>
      <View style={styles.list}>
        <Text style={styles.listItem}>• Check the price history graph before buying. If a product has been sitting at the "discounted" price for months, it was never really on sale.</Text>
        <Text style={styles.listItem}>• Compare the current price against the 90-day average, not just what it cost yesterday.</Text>
        <Text style={styles.listItem}>• Be skeptical of deals that appear exclusively during major sale events with suspiciously round discount figures, "originally ₹9,999, now ₹4,999" is a classic pattern.</Text>
        <Text style={styles.listItem}>• Look for products where the price has genuinely dropped below its historical floor, that's where real, actionable savings exist.</Text>
      </View>

      <Text accessibilityRole="heading" aria-level={4} style={styles.h4}>Why Daily Deals Expire Fast - And How to Secure Them</Text>
      <Text style={styles.paragraph}>
        Genuine price drops attract demand quickly. When a product hits its lowest recorded price, stock clears fast - often within a few hours of the deal going live. This isn't artificial scarcity; it's what happens when a real deal reaches a deal-aware audience.
      </Text>
      <Text style={styles.paragraph}>Here's how to stay consistently ahead:</Text>
      <View style={styles.list}>
        <Text style={styles.listItem}>• Check our live feed regularly. You'll get notified the moment the price falls to your target.</Text>
        <Text style={styles.listItem}>• Don't add to the wishlist and wait to act when the alert arrives. Genuine deals don't wait for you.</Text>
        <Text style={styles.listItem}>• Check the deals page early morning, many price drops go live between midnight and 8 AM IST, before broader traffic arrives.</Text>
        <Text style={styles.listItem}>• Always verify stock availability before spending time comparing bank offers or cashback stacking options.</Text>
      </View>

      <Text accessibilityRole="heading" aria-level={3} style={styles.h3}>Category-Wise Deal Breakdown - Where the Real Savings Are</Text>
      <Text style={styles.paragraph}>
        Different product categories behave very differently in pricing patterns, discount cycles, and the depth of genuine savings available. Here's how ShoppersDeals approaches each major category on the deals page - and what you should keep in mind when shopping each one.
      </Text>

      <View style={styles.list}>
        <Text style={styles.listItem}>
          <Text style={styles.bold}>Electronics:</Text> Price tracking delivers the highest return here. Smartphone prices, for instance, tend to drop sharply 2-3 months after a launch as inventory builds and newer models enter the pipeline. In the electronics category, ShoppersDeals prioritizes deals offering at least 20% genuine savings compared to the 3-month average price. For high-value items like laptops, smart TVs, and audio equipment, even a 10-15% real price drop translates to thousands of rupees in actual savings - especially when stacked with a bank offer.
        </Text>
        <Text style={styles.listItem}>
          <Text style={styles.bold}>Fashion and Accessories:</Text> Fashion pricing is volatile and moves fast. Discounts on clothing and footwear can swing dramatically within the same week, depending on inventory levels and platform promotions. In this category, we focus on deals where the current price sits below the 30-day average with verified stock. End-of-season clearance events typically offer the deepest and most legitimate cuts in fashion - those get flagged and highlighted prominently on the deals page as they appear.
        </Text>
        <Text style={styles.listItem}>
          <Text style={styles.bold}>Home Essentials & Appliances:</Text> Home appliances - air coolers, water purifiers, kitchen gadgets, and storage solutions - tend to see their best prices during festive season sales. Outside of major sale windows, genuine deals in this category are less frequent but more significant when they appear. ShoppersDeals tracks these products daily and flags deals only when the price crosses below its historical floor, not just a marginal dip.
        </Text>
        <Text style={styles.listItem}>
          <Text style={styles.bold}>Grooming & Personal Care:</Text> FMCG and personal care products rotate quickly, and deals in this category are best evaluated on a per-unit-price basis. Combo packs and bundle offers often deliver more mathematical value than single-product discounts. ShoppersDeals tracks unit pricing across pack sizes so that the "deal" you see is one that actually makes economic sense - not just one that looks large on the label.
        </Text>
      </View>

      <Text accessibilityRole="heading" aria-level={3} style={styles.h3}>Average Savings Comparison: Regular Shopping vs. Daily Deals</Text>
      <Text style={styles.paragraph}>
        Here's a data-backed breakdown of what verified daily deals on ShoppersDeals deliver compared to standard untracked online shopping:
      </Text>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, styles.bold]}>Savings Factor</Text>
          <Text style={[styles.tableCell, styles.bold]}>Regular Shopping</Text>
          <Text style={[styles.tableCell, styles.bold]}>Daily Deals (ShoppersDeals Verified)</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Avg. Discount on Electronics</Text>
          <Text style={styles.tableCell}>5 - 10%</Text>
          <Text style={styles.tableCell}>20 - 40%</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Price Verification</Text>
          <Text style={styles.tableCell}>None</Text>
          <Text style={styles.tableCell}>Cross-checked via price history</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Bank Offers</Text>
          <Text style={styles.tableCell}>Not tracked</Text>
          <Text style={styles.tableCell}>Stackable tracked</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Price History Check</Text>
          <Text style={styles.tableCell}>Manual effort</Text>
          <Text style={styles.tableCell}>Automated via ShoppersDeals AI</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Deal Authenticity</Text>
          <Text style={styles.tableCell}>Unverified</Text>
          <Text style={styles.tableCell}>Manually reviewed</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Stock Availability Check</Text>
          <Text style={styles.tableCell}>No</Text>
          <Text style={styles.tableCell}>Yes - real-time</Text>
        </View>
      </View>
      <Text style={[styles.paragraph, { fontSize: 12, fontStyle: 'italic', marginTop: 8 }]}>
        Savings estimates based on ShoppersDeals historical price tracking data across Amazon, Flipkart, and partner platforms.
      </Text>
      
      <Text accessibilityRole="heading" aria-level={3} style={styles.h3}>Frequently Asked Questions</Text>
      <Text style={styles.paragraph}>We heard you. Get reliable, verified answers here.</Text>
      <View style={styles.list}>
        <Text style={styles.listItem}><Text style={styles.bold}>How frequently are deals updated?</Text> Deals are updated in real-time. Our AI engine scans deals 24/7 and updates the feed instantly.</Text>
        <Text style={styles.listItem}><Text style={styles.bold}>Are the deals verified?</Text> Yes. Every deal goes through an automated price-history check and a manual review to ensure it's a genuine price drop.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 40,
    width: '100%',
  },
  h2: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
    marginTop: 24,
  },
  h3: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
    marginTop: 24,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 10,
    marginTop: 16,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 24,
    color: '#94a3b8',
    marginBottom: 16,
  },
  list: {
    marginBottom: 16,
    paddingLeft: 10,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 24,
    color: '#94a3b8',
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
    color: '#cbd5e1',
  },
  table: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tableHeader: {
    backgroundColor: '#1e293b',
  },
  tableCell: {
    flex: 1,
    padding: 12,
    color: '#cbd5e1',
    fontSize: 13,
  },
});
