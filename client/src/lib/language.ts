import { useState, useEffect } from "react";

const LANG_KEY = "xenox_language";
export type Lang = "bn" | "en";

const T: Record<string, { bn: string; en: string }> = {
  // ── Settings ─────────────────────────────────────────────────
  "settings.title":           { bn: "সেটিংস",                        en: "Settings" },
  "settings.change_pass":     { bn: "পাসওয়ার্ড পরিবর্তন",             en: "Change Password" },
  "settings.language":        { bn: "ভাষা / Language",               en: "Language" },
  "settings.logout":          { bn: "লগ আউট",                        en: "Log Out" },
  "settings.current_pass":    { bn: "বর্তমান পাসওয়ার্ড",              en: "Current Password" },
  "settings.new_pass":        { bn: "নতুন পাসওয়ার্ড",                 en: "New Password" },
  "settings.confirm_pass":    { bn: "পাসওয়ার্ড নিশ্চিত করুন",         en: "Confirm Password" },
  "settings.save":            { bn: "সেভ করুন",                      en: "Save" },
  "settings.cancel":          { bn: "বাতিল",                         en: "Cancel" },
  "settings.saving":          { bn: "সেভ হচ্ছে...",                   en: "Saving..." },
  "settings.pass_success":    { bn: "পাসওয়ার্ড পরিবর্তন হয়েছে!",      en: "Password changed!" },
  "settings.pass_mismatch":   { bn: "পাসওয়ার্ড মিলছে না",              en: "Passwords do not match" },
  "settings.pass_short":      { bn: "কমপক্ষে ৬ অক্ষর দিন",            en: "Minimum 6 characters" },
  "settings.pass_wrong":      { bn: "বর্তমান পাসওয়ার্ড ভুল",           en: "Current password is wrong" },
  "settings.change_email":    { bn: "ইমেইল পরিবর্তন",                 en: "Change E-mail" },
  "settings.new_email":       { bn: "নতুন ইমেইল",                     en: "New E-mail" },
  "settings.email_pass":      { bn: "পাসওয়ার্ড (নিশ্চিত করতে)",       en: "Password (to confirm)" },
  "settings.email_success":   { bn: "ইমেইল পরিবর্তন হয়েছে!",           en: "E-mail changed!" },
  "settings.email_invalid":   { bn: "সঠিক ইমেইল দিন",                en: "Enter a valid e-mail" },
  "settings.email_taken":     { bn: "এই ইমেইল ব্যবহৃত হচ্ছে",          en: "E-mail already in use" },
  "settings.email_wrong_pass":{ bn: "পাসওয়ার্ড ভুল",                  en: "Incorrect password" },

  // ── Home ─────────────────────────────────────────────────────
  "home.balance":             { bn: "আপনার ব্যালেন্স",                 en: "Your Balance" },
  "home.add_balance":         { bn: "Add Balance",                   en: "Add Balance" },
  "home.history":             { bn: "History",                       en: "History" },
  "home.subscription":        { bn: "Subscription",                  en: "Subscription" },
  "home.service_active":      { bn: "SERVICE: ACTIVE",               en: "SERVICE: ACTIVE" },
  "home.service_inactive":    { bn: "SERVICE: INACTIVE",             en: "SERVICE: INACTIVE" },
  "home.time_left":           { bn: "সময় আছে",                       en: "Time Left" },
  "home.expired":             { bn: "মেয়াদ শেষ",                     en: "Expired" },
  "home.renew":               { bn: "সাবস্ক্রিপশন নবায়ন করুন →",     en: "Renew Subscription →" },
  "home.no_sub":              { bn: "সাবস্ক্রিপশন নেই",               en: "No Subscription" },
  "home.buy_sub":             { bn: "সাবস্ক্রিপশন কিনুন →",           en: "Buy Subscription →" },
  "home.login_prompt":        { bn: "সার্ভিস পেতে লগইন করুন",         en: "Login to access services" },
  "home.login_btn":           { bn: "Login করুন",                    en: "Login" },
  "home.signup_btn":          { bn: "Sign Up করুন",                  en: "Sign Up" },
  "home.free_bonus":          { bn: "🎁 FREE BONUS চলছে",             en: "🎁 FREE BONUS ACTIVE" },
  "home.bonus_ends":          { bn: "শেষ হবে",                       en: "Ends in" },
  "home.bonus_starts":        { bn: "শুরু হবে",                       en: "Starts in" },
  "home.locked_msg":          { bn: "সাবস্ক্রিপশন কিনলে আনলক হবে",   en: "Subscribe to unlock" },

  // ── Menu items ───────────────────────────────────────────────
  "menu.float_sheet":         { bn: "FLOAT SHEET SET-UP",            en: "FLOAT SHEET SET-UP" },
  "menu.float_desc":          { bn: "Google Sheets সংযোগ সেট আপ করুন", en: "Set up your Google Sheets connection" },
  "menu.app_script":          { bn: "GOOGLE SHEET APP SCRIPT",       en: "GOOGLE SHEET APP SCRIPT" },
  "menu.app_desc":            { bn: "Apps Script কোড পান ও কপি করুন", en: "Get and copy the Apps Script code" },
  "menu.local_space":         { bn: "LOCAL APP SPACE MODE",          en: "LOCAL APP SPACE MODE" },
  "menu.local_desc":          { bn: "Internet ছাড়া App-এর ভেতরেই ডেটা সংরক্ষণ করুন", en: "Store data offline within the app" },
  "menu.create_acc":          { bn: "CREATE ACC",                    en: "CREATE ACC" },
  "menu.create_desc":         { bn: "Instagram ও Facebook অ্যাকাউন্ট তৈরি করুন", en: "Create Instagram and Facebook accounts" },
  "menu.contact":             { bn: "CONTACT SUPPORT",               en: "CONTACT SUPPORT" },
  "menu.contact_desc":        { bn: "Telegram-এ সাপোর্টে যোগাযোগ করুন", en: "Contact support on Telegram" },

  // ── Ticket notification ───────────────────────────────────────
  "ticket.admin_replied":     { bn: "টিকেটে রিপ্লাই এসেছে",           en: "Ticket reply received" },

  // ── Login ────────────────────────────────────────────────────
  "login.title":              { bn: "স্বাগতম!",                       en: "Welcome Back" },
  "login.subtitle":           { bn: "Xenox Short-এ লগইন করুন",       en: "Login to Xenox Short" },
  "login.email_label":        { bn: "ইমেইল বা ইউজারনেম",              en: "Email or Username" },
  "login.email_placeholder":  { bn: "ইমেইল বা ইউজারনেম",              en: "Email or username" },
  "login.pass_label":         { bn: "পাসওয়ার্ড",                      en: "Password" },
  "login.forgot":             { bn: "পাসওয়ার্ড ভুলে গেছেন?",           en: "Forgot password?" },
  "login.btn":                { bn: "Login",                         en: "Login" },
  "login.logging_in":         { bn: "লগইন হচ্ছে...",                  en: "Logging in..." },
  "login.no_account":         { bn: "অ্যাকাউন্ট নেই?",                en: "No account?" },
  "login.err_empty":          { bn: "ইমেইল/ইউজারনেম ও পাসওয়ার্ড দিন।", en: "Enter email/username and password." },
  "login.err_failed":         { bn: "লগইন ব্যর্থ হয়েছে।",             en: "Login failed." },
  "login.forgot_title":       { bn: "পাসওয়ার্ড ভুলে গেছেন?",           en: "Forgot Password?" },
  "login.forgot_desc":        { bn: "আপনার রেজিস্ট্রেশনের ইমেইল দিন। সেই ইমেইলে একটি নতুন পাসওয়ার্ড পাঠানো হবে।", en: "Enter your registered email. A new password will be sent to it." },
  "login.forgot_placeholder": { bn: "আপনার ইমেইল",                    en: "Your email" },
  "login.forgot_sending":     { bn: "পাঠানো হচ্ছে...",                en: "Sending..." },
  "login.forgot_btn":         { bn: "নতুন পাসওয়ার্ড পান",              en: "Get New Password" },
  "login.forgot_new_label":   { bn: "নতুন পাসওয়ার্ড",                  en: "New Password" },
  "login.forgot_use":         { bn: "এই পাসওয়ার্ড দিয়ে লগইন করুন",    en: "Use this password to login" },
  "login.forgot_email_sent":  { bn: "নতুন পাসওয়ার্ড আপনার ইমেইলে পাঠানো হয়েছে।", en: "New password sent to your email." },
  "login.forgot_made":        { bn: "নতুন পাসওয়ার্ড তৈরি হয়েছে। নিচে দেখুন:", en: "New password created. See below:" },
  "login.forgot_err":         { bn: "সমস্যা হয়েছে, আবার চেষ্টা করুন।", en: "Something went wrong, try again." },
  "login.forgot_network":     { bn: "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।", en: "Network error. Please try again." },
  "login.forgot_close":       { bn: "বন্ধ করুন",                      en: "Close" },

  // ── Signup ───────────────────────────────────────────────────
  "signup.title":             { bn: "অ্যাকাউন্ট তৈরি করুন",           en: "Create Account" },
  "signup.subtitle":          { bn: "আজই Xenox Short-এ যোগ দিন",     en: "Join Xenox Short today" },
  "signup.email_label":       { bn: "ইমেইল",                         en: "Email" },
  "signup.username_label":    { bn: "ইউজারনেম",                      en: "Username" },
  "signup.username_hint":     { bn: "আপনার Telegram username দিন",    en: "Enter your Telegram username" },
  "signup.username_tg_note":  { bn: "আপনার Telegram username দিন", en: "Enter your Telegram username" },
  "signup.username_warning":  { bn: "অবশ্যই আপনার Telegram username দিন — যাতে আমরা প্রয়োজনে আপনার সাথে যোগাযোগ করতে পারি।", en: "You must provide your Telegram username — so we can contact you if needed." },
  "signup.gender_label":      { bn: "লিঙ্গ",                         en: "Gender" },
  "signup.pass_label":        { bn: "পাসওয়ার্ড",                      en: "Password" },
  "signup.pass_placeholder":  { bn: "কমপক্ষে ৬ অক্ষর",               en: "Minimum 6 characters" },
  "signup.confirm_label":     { bn: "পাসওয়ার্ড নিশ্চিত করুন",         en: "Confirm Password" },
  "signup.confirm_placeholder":{ bn: "পাসওয়ার্ড আবার দিন",             en: "Enter password again" },
  "signup.creating":          { bn: "অ্যাকাউন্ট তৈরি হচ্ছে...",       en: "Creating account..." },
  "signup.btn":               { bn: "Sign Up",                       en: "Sign Up" },
  "signup.have_account":      { bn: "অ্যাকাউন্ট আছে?",                en: "Have an account?" },
  "signup.err_email":         { bn: "সঠিক ইমেইল দিন।",               en: "Enter a valid email." },
  "signup.err_gmail":         { bn: "শুধুমাত্র @gmail.com ইমেইল দিয়ে অ্যাকাউন্ট তৈরি করা যাবে।", en: "Only @gmail.com emails are accepted." },
  "signup.err_username":      { bn: "ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে।", en: "Username must be at least 3 characters." },
  "signup.err_gender":        { bn: "Male বা Female সিলেক্ট করুন।",   en: "Please select Male or Female." },
  "signup.err_pass_short":    { bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।", en: "Password must be at least 6 characters." },
  "signup.err_pass_mismatch": { bn: "পাসওয়ার্ড দুটো মিলছে না।",       en: "Passwords do not match." },
  "signup.err_failed":        { bn: "রেজিস্ট্রেশন ব্যর্থ হয়েছে।",     en: "Registration failed." },

  // ── Add Balance ──────────────────────────────────────────────
  "balance.title":            { bn: "ব্যালেন্স যোগ করুন",              en: "Add Balance" },
  "balance.subtitle":         { bn: "Manual Top-up Request",         en: "Manual Top-up Request" },
  "balance.instruction":      { bn: "নিচের যেকোনো পেমেন্ট মেথডে টাকা পাঠিয়ে ট্রান্জেকশন আইডি দিন। Admin রিভিউ করে আপনার ব্যালেন্স যোগ করে দেবে।", en: "Send money via any payment method below and enter the Transaction ID. Admin will review and add your balance." },
  "balance.choose_method":    { bn: "পেমেন্ট মেথড বেছে নিন",          en: "Choose Payment Method" },
  "balance.request_title":    { bn: "Top-up অনুরোধ করুন",             en: "Request Top-up" },
  "balance.sender_number":    { bn: "পেমেন্ট পাঠানোর নম্বর",           en: "Sender Number" },
  "balance.sender_placeholder":{ bn: "যে নম্বর থেকে পাঠিয়েছেন",       en: "Number you sent from" },
  "balance.amount":           { bn: "পরিমাণ (টাকা)",                  en: "Amount (৳)" },
  "balance.amount_placeholder":{ bn: "সর্বনিম্ন ১০ টাকা",              en: "Minimum ৳10" },
  "balance.amount_warning":   { bn: "⚠ সর্বনিম্ন ১০ টাকা — এর কম হলে অনুরোধ গ্রহণ করা হবে না", en: "⚠ Minimum ৳10 — requests below this will not be accepted" },
  "balance.method_label":     { bn: "পেমেন্ট মেথড",                   en: "Payment Method" },
  "balance.select_up":        { bn: "উপরে মেথড বেছে নিন",              en: "Select method above" },
  "balance.txn_id":           { bn: "ট্রান্জেকশন আইডি",                en: "Transaction ID" },
  "balance.txn_placeholder":  { bn: "TXN ID দিন",                    en: "Enter TXN ID" },
  "balance.note_label":       { bn: "নোট (ঐচ্ছিক)",                   en: "Note (optional)" },
  "balance.note_placeholder": { bn: "কোনো বিশেষ তথ্য থাকলে লিখুন",    en: "Any additional info" },
  "balance.send_btn":         { bn: "অনুরোধ পাঠান",                   en: "Send Request" },
  "balance.sending":          { bn: "পাঠানো হচ্ছে...",                 en: "Sending..." },
  "balance.success_title":    { bn: "অনুরোধ পাঠানো হয়েছে!",            en: "Request Sent!" },
  "balance.success_desc":     { bn: "Admin রিভিউ করার পর আপনার ব্যালেন্সে যোগ হবে।", en: "Admin will review and add your balance." },
  "balance.another":          { bn: "আরেকটি অনুরোধ",                  en: "Another Request" },
  "balance.view_history":     { bn: "ইতিহাস দেখুন",                   en: "View History" },
  "balance.login_to_send":    { bn: "অনুরোধ পাঠাতে",                  en: "To send request," },
  "balance.login_link":       { bn: "লগইন করুন",                     en: "login" },
  "balance.err_login":        { bn: "অনুরোধ পাঠাতে প্রথমে লগইন করুন।", en: "Please login first to send a request." },
  "balance.err_method":       { bn: "পেমেন্ট মেথড বেছে নিন।",          en: "Please select a payment method." },
  "balance.err_number":       { bn: "আপনার নম্বর দিন (যেটা থেকে পাঠিয়েছেন)।", en: "Enter the number you sent from." },
  "balance.err_amount":       { bn: "সর্বনিম্ন ১০ টাকা যোগ করতে হবে।", en: "Minimum ৳10 required." },
  "balance.err_txn":          { bn: "ট্রান্জেকশন আইডি দিন।",           en: "Enter Transaction ID." },
  "balance.err_failed":       { bn: "অনুরোধ পাঠানো যায়নি।",            en: "Could not send request." },
  "balance.err_network":      { bn: "নেটওয়ার্ক এরর। আবার চেষ্টা করুন।", en: "Network error. Please try again." },

  // ── History ──────────────────────────────────────────────────
  "history.title":            { bn: "লেনদেনের ইতিহাস",                 en: "Transaction History" },
  "history.total_added":      { bn: "মোট যোগ হয়েছে",                  en: "Total Added" },
  "history.total_requests":   { bn: "মোট অনুরোধ",                    en: "Total Requests" },
  "history.loading":          { bn: "লোড হচ্ছে...",                   en: "Loading..." },
  "history.empty":            { bn: "কোনো লেনদেন নেই",                 en: "No transactions" },
  "history.empty_desc":       { bn: "ব্যালেন্স যোগ করলে এখানে দেখাবে", en: "Add balance to see history here" },
  "history.add_balance_btn":  { bn: "ব্যালেন্স যোগ করুন",              en: "Add Balance" },
  "history.add_more":         { bn: "+ আরো ব্যালেন্স যোগ করুন",        en: "+ Add More Balance" },
  "history.method":           { bn: "মেথড",                           en: "Method" },
  "history.login":            { bn: "লগইন করুন",                     en: "Login" },

  // ── Subscription ─────────────────────────────────────────────
  "sub.title":                { bn: "সাবস্ক্রিপশন",                    en: "Subscription" },
  "sub.choose":               { bn: "আপনার জন্য সঠিক প্ল্যান বেছে নিন", en: "Choose the right plan for you" },
  "sub.current_sub":          { bn: "বর্তমান সাবস্ক্রিপশন",             en: "Current Subscription" },
  "sub.expires":              { bn: "মেয়াদ",                          en: "Expires" },
  "sub.current_plan":         { bn: "বর্তমান প্ল্যান",                 en: "Current Plan" },
  "sub.active":               { bn: "✓ সক্রিয় আছে",                  en: "✓ Active" },
  "sub.subscribe":            { bn: "সাবস্ক্রাইব করুন",                en: "Subscribe" },
  "sub.popular":              { bn: "জনপ্রিয়",                        en: "Popular" },
  "sub.free_always":          { bn: "সবসময়",                          en: "Always" },
  "sub.low_balance_hint":     { bn: "ব্যালেন্স কম — আরও",             en: "Low balance — add" },
  "sub.low_balance_more":     { bn: "যোগ করুন",                       en: "more" },
  "sub.modal_title":          { bn: "সাবস্ক্রাইব করুন",                en: "Subscribe" },
  "sub.modal_plan":           { bn: "প্ল্যান",                         en: "Plan" },
  "sub.modal_price":          { bn: "মূল্য",                          en: "Price" },
  "sub.modal_balance":        { bn: "বর্তমান ব্যালেন্স",               en: "Current Balance" },
  "sub.modal_after":          { bn: "পরে ব্যালেন্স",                   en: "Balance After" },
  "sub.low_balance_msg":      { bn: "ব্যালেন্স পর্যাপ্ত নয়। আগে ব্যালেন্স যোগ করুন।", en: "Insufficient balance. Please add balance first." },
  "sub.add_balance":          { bn: "ব্যালেন্স যোগ করুন",              en: "Add Balance" },
  "sub.confirm":              { bn: "নিশ্চিত করুন ও সাবস্ক্রাইব",      en: "Confirm & Subscribe" },
  "sub.processing":           { bn: "প্রক্রিয়া চলছে...",               en: "Processing..." },
  "sub.success":              { bn: "প্ল্যান সফলভাবে সক্রিয় হয়েছে! নতুন ব্যালেন্স", en: "Plan activated! New balance" },
  "sub.err_problem":          { bn: "কিছু একটা সমস্যা হয়েছে",           en: "Something went wrong" },
  "sub.err_network":          { bn: "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।", en: "Network error. Please try again." },

  // ── Contact Support ───────────────────────────────────────────
  "support.title":            { bn: "Contact Support",               en: "Contact Support" },
  "support.tg_title":         { bn: "Telegram সাপোর্ট",               en: "Telegram Support" },
  "support.tg_desc":          { bn: "যেকোনো সমস্যায় আমাদের Telegram-এ যোগাযোগ করুন", en: "Contact us on Telegram for any issue" },
  "support.links_label":      { bn: "যোগাযোগের লিংক",                 en: "Contact Links" },
  "support.channel_label":    { bn: "Telegram চ্যানেল",               en: "Telegram Channel" },
  "support.channel_desc":     { bn: "আপডেট ও নিউজের জন্য",            en: "For updates and news" },
  "support.support_label":    { bn: "Telegram সাপোর্ট",               en: "Telegram Support" },
  "support.support_desc":     { bn: "সরাসরি সাহায্যের জন্য",           en: "For direct assistance" },
  "support.tickets_label":    { bn: "আমার সাপোর্ট টিকেট",              en: "My Support Tickets" },
  "support.tickets_desc":     { bn: "নতুন টিকেট খুলুন বা পুরনো টিকেটের অবস্থা দেখুন", en: "Open a new ticket or check existing ones" },
  "support.faq_label":        { bn: "সাধারণ প্রশ্ন (FAQ)",             en: "FAQ" },
  "support.other":            { bn: "অন্যান্য",                        en: "Other Info" },
  "support.hours_label":      { bn: "সাপোর্ট সময়",                    en: "Support Hours" },
  "support.hours_val":        { bn: "সকাল ৯টা - রাত ১১টা (BD Time)", en: "9 AM - 11 PM (BD Time)" },
  "support.response_label":   { bn: "সাড়া দেওয়ার সময়",                en: "Response Time" },
  "support.response_val":     { bn: "সাধারণত ১-২ ঘণ্টার মধ্যে",       en: "Usually within 1-2 hours" },
  "support.version_label":    { bn: "অ্যাপ ভার্সন",                   en: "App Version" },
  "faq.q1":                   { bn: "Google Sheet কীভাবে সংযুক্ত করব?", en: "How do I connect Google Sheet?" },
  "faq.a1":                   { bn: "Float Sheet Set-Up পেজে যান, Sheet URL ও Sheet ID দিন। Sheet ID হলো URL-এর /d/ এর পরের অংশ।", en: "Go to Float Sheet Set-Up page, enter the Sheet URL and Sheet ID. Sheet ID is the part after /d/ in the URL." },
  "faq.q2":                   { bn: "Apps Script কোথায় পেস্ট করব?",    en: "Where do I paste the Apps Script?" },
  "faq.a2":                   { bn: "Google Sheet খুলুন > Extensions > Apps Script > কোড পেস্ট করুন > Deploy করুন।", en: "Open Google Sheet > Extensions > Apps Script > paste the code > Deploy." },
  "faq.q3":                   { bn: "2FA কোড কীভাবে যোগ করব?",         en: "How do I add 2FA code?" },
  "faq.a3":                   { bn: "2FA Tools পেজে যান, সার্ভিসের নাম ও Secret Key দিন। TOTP কোড স্বয়ংক্রিয়ভাবে তৈরি হবে।", en: "Go to 2FA Tools page, enter the service name and Secret Key. TOTP code will be generated automatically." },

  // ── Tickets ──────────────────────────────────────────────────
  "tickets.title":            { bn: "সাপোর্ট টিকেট",                  en: "Support Tickets" },
  "tickets.login_msg":        { bn: "সাপোর্ট টিকেটের জন্য লগইন করুন", en: "Login to access support tickets" },
  "tickets.info":             { bn: "সমস্যার বিবরণ দিয়ে টিকেট খুলুন। Admin রিভিউ করে জবাব দেবে।", en: "Open a ticket with your issue. Admin will review and reply." },
  "tickets.empty":            { bn: "কোনো টিকেট নেই",                 en: "No tickets" },
  "tickets.first":            { bn: "প্রথম টিকেট খুলুন",               en: "Open First Ticket" },
  "tickets.new_title":        { bn: "নতুন সাপোর্ট টিকেট",              en: "New Support Ticket" },
  "tickets.subject_label":    { bn: "বিষয় (Subject)",                 en: "Subject" },
  "tickets.subject_ph":       { bn: "সমস্যার সংক্ষিপ্ত বিবরণ",         en: "Brief description of your issue" },
  "tickets.detail_label":     { bn: "বিস্তারিত বিবরণ",                 en: "Detailed Description" },
  "tickets.detail_ph":        { bn: "সমস্যার বিস্তারিত বর্ণনা করুন...", en: "Describe your issue in detail..." },
  "tickets.cancel":           { bn: "বাতিল",                         en: "Cancel" },
  "tickets.send":             { bn: "পাঠান",                         en: "Send" },
  "tickets.err_login":        { bn: "লগইন করুন।",                    en: "Please login." },
  "tickets.err_fields":       { bn: "সব তথ্য দিন।",                  en: "Please fill all fields." },
  "tickets.err_failed":       { bn: "টিকেট পাঠানো যায়নি।",            en: "Could not send ticket." },
  "tickets.err_network":      { bn: "নেটওয়ার্ক এরর।",                 en: "Network error." },

  // ── Notifications ────────────────────────────────────────────
  "notif.title":              { bn: "নোটিফিকেশন",                     en: "Notifications" },
  "notif.loading":            { bn: "লোড হচ্ছে...",                   en: "Loading..." },
  "notif.empty":              { bn: "কোনো নোটিফিকেশন নেই",             en: "No notifications" },
  "notif.empty_desc":         { bn: "Admin কোনো নোটিশ পাঠালে এখানে দেখাবে", en: "Admin notices will appear here" },

  // ── App Script page ──────────────────────────────────────────
  "script.title":             { bn: "Google Sheet App Script",       en: "Google Sheet App Script" },
  "script.how_to":            { bn: "HOW TO USE:",                   en: "HOW TO USE:" },
  "script.step1":             { bn: "Google Sheet খুলুন → Extensions → Apps Script", en: "Open Google Sheet → Extensions → Apps Script" },
  "script.step2":             { bn: "Editor-এর পুরনো কোড মুছে এই কোড পেস্ট করুন", en: "Delete old code in the editor and paste this code" },
  "script.step3":             { bn: "Deploy → New Deployment → Web App", en: "Deploy → New Deployment → Web App" },
  "script.step4":             { bn: "Execute as: Me | Who has access: Anyone", en: "Execute as: Me | Who has access: Anyone" },
  "script.step5":             { bn: "Deploy URL টি Xenox Short App-এ দিন", en: "Paste the Deploy URL in Xenox Short App" },
  "script.warning":           { bn: "Deploy করার সময় \"Execute as: Me\" এবং \"Who has access: Anyone\" সিলেক্ট করুন। না হলে App থেকে কাজ করবে না।", en: "When deploying, select \"Execute as: Me\" and \"Who has access: Anyone\". Otherwise the App won't work." },
  "script.guide_btn":         { bn: "📋 বিস্তারিত সেটআপ গাইড",        en: "📋 Detailed Setup Guide" },
  "script.actions_btn":       { bn: "স্ক্রিপ্ট কী কী করতে পারে?",     en: "What can the script do?" },
  "script.code_label":        { bn: "Apps Script কোড",               en: "Apps Script Code" },
  "script.copy_btn":          { bn: "কপি করুন",                      en: "Copy Code" },
  "script.copied":            { bn: "কপি হয়েছে!",                    en: "Copied!" },
  "script.open_support":      { bn: "Support খুলুন",                 en: "Open Support" },
  "script.get_btn":           { bn: "Script নিন",                    en: "Get Script" },
  "script.collect_btn":       { bn: "Script সংগ্রহ করুন",             en: "Collect Script" },

  // ── Float Sheet Setup ────────────────────────────────────────
  "float.title":              { bn: "Float Sheet Set-Up",            en: "Float Sheet Set-Up" },
  "float.mode_local":         { bn: "Local Mode",                    en: "Local Mode" },
  "float.mode_google":        { bn: "Google Mode",                   en: "Google Mode" },
  "float.web_app_url":        { bn: "Apps Script URL সঠিক আছে",      en: "Apps Script URL is valid" },
  "float.url_hint":           { bn: "Google Apps Script Deploy করার পর যে URL পাবেন সেটি এখানে দিন", en: "Enter the URL you get after deploying Google Apps Script" },
  "float.col_hint":           { bn: "কমা দিয়ে আলাদা করুন — যেমন A,B,C,D,E", en: "Separate with commas — e.g. A,B,C,D,E" },
  "float.preview_label":      { bn: "Preview — Launcher bubble এ এরকম দেখাবে", en: "Preview — this is how the Launcher bubble will look" },
  "float.save_btn":           { bn: "সেভ করুন",                      en: "Save" },
  "float.save_success":       { bn: "সেটআপ সেভ হয়েছে!",              en: "Setup saved!" },
  "float.reset_btn":          { bn: "রিসেট",                        en: "Reset" },

  // ── Local Sheet ──────────────────────────────────────────────
  "local.title":              { bn: "Xenox App Sheet Mode",           en: "Xenox App Sheet Mode" },
  "local.no_data":            { bn: "কোনো ডেটা নেই",                  en: "No data" },
  "local.clear_btn":          { bn: "মুছুন",                         en: "Clear" },
  "local.export_btn":         { bn: "Export",                        en: "Export" },

  // ── Create Acc ───────────────────────────────────────────────
  "createacc.title":          { bn: "অ্যাকাউন্ট তৈরি করুন",           en: "Create Account" },
  "createacc.add_acc":        { bn: "অ্যাকাউন্ট যোগ করুন",             en: "Add Account" },
  "createacc.new_acc":        { bn: "নতুন অ্যাকাউন্ট তৈরি",            en: "Create New Account" },
  "createacc.new_acc_desc":   { bn: "Create New Account — App-এর ভেতরে", en: "Create New Account — Inside the App" },
  "createacc.login_acc":      { bn: "অন্য অ্যাকাউন্টে লগিন",          en: "Login to Another Account" },
  "createacc.login_acc_desc": { bn: "Login — App-এর ভেতরে",          en: "Login — Inside the App" },

  // ── Common ───────────────────────────────────────────────────
  "common.loading":           { bn: "লোড হচ্ছে...",                   en: "Loading..." },
  "common.login_btn":         { bn: "Login করুন",                    en: "Login" },
  "common.cancel":            { bn: "বাতিল",                         en: "Cancel" },
  "common.close":             { bn: "বন্ধ করুন",                      en: "Close" },
  "common.ok":                { bn: "বুঝেছি",                        en: "Got it" },
  "common.just_now":          { bn: "এইমাত্র",                       en: "just now" },

  // ── 2FA Tools ────────────────────────────────────────────────
  "twofa.deleted":            { bn: "মুছে ফেলা হয়েছে",               en: "Deleted" },
  "twofa.copied":             { bn: "কোড কপি হয়েছে!",               en: "Code copied!" },
  "twofa.added":              { bn: "2FA কোড যোগ হয়েছে",             en: "2FA code added" },
  "twofa.error":              { bn: "ত্রুটি",                         en: "Error" },
  "twofa.add_new":            { bn: "নতুন 2FA যোগ করুন",              en: "Add New 2FA" },
  "twofa.service_label":      { bn: "সার্ভিসের নাম *",               en: "Service Name *" },
  "twofa.service_ph":         { bn: "যেমন: Gmail, Instagram",         en: "e.g. Gmail, Instagram" },
  "twofa.issuer_label":       { bn: "Issuer (ঐচ্ছিক)",               en: "Issuer (optional)" },
  "twofa.issuer_ph":          { bn: "যেমন: Google, Meta",             en: "e.g. Google, Meta" },
  "twofa.required_err":       { bn: "নাম ও Secret Key আবশ্যক",       en: "Name and Secret Key required" },
  "twofa.adding":             { bn: "যোগ হচ্ছে...",                  en: "Adding..." },
  "twofa.add_btn":            { bn: "2FA যোগ করুন",                  en: "Add 2FA" },
  "twofa.time_left":          { bn: "s বাকি",                        en: "s left" },
  "twofa.refreshing":         { bn: "- নতুন হচ্ছে...",               en: "- refreshing..." },
  "twofa.add_new_btn":        { bn: "নতুন 2FA কোড যোগ করুন",         en: "Add New 2FA Code" },
  "twofa.accounts_suffix":    { bn: "টি অ্যাকাউন্ট",                 en: " Accounts" },
  "twofa.empty":              { bn: "কোনো 2FA কোড নেই",              en: "No 2FA codes" },
  "twofa.empty_desc":         { bn: "উপরের বোতামে ক্লিক করে 2FA যোগ করুন", en: "Click the button above to add 2FA" },
  "twofa.info":               { bn: "আপনার 2FA Secret Key যোগ করুন। TOTP কোড প্রতি ৩০ সেকেন্ডে স্বয়ংক্রিয়ভাবে পরিবর্তন হয়।", en: "Add your 2FA Secret Key. TOTP code changes automatically every 30 seconds." },

  // ── Local Data ───────────────────────────────────────────────
  "localdata.saved":          { bn: "ডেটা সংরক্ষিত হয়েছে",           en: "Data saved" },
  "localdata.error":          { bn: "ত্রুটি",                         en: "Error" },
  "localdata.deleted":        { bn: "মুছে ফেলা হয়েছে",               en: "Deleted" },
  "localdata.updated":        { bn: "আপডেট হয়েছে",                   en: "Updated" },
  "localdata.add_new":        { bn: "নতুন ডেটা যোগ করুন",             en: "Add New Data" },
  "localdata.label_field":    { bn: "লেবেল",                          en: "Label" },
  "localdata.label_ph":       { bn: "ডেটার নাম",                      en: "Data name" },
  "localdata.value_field":    { bn: "মান (Value)",                    en: "Value" },
  "localdata.value_ph":       { bn: "ডেটার মান",                      en: "Data value" },
  "localdata.cat_field":      { bn: "ক্যাটাগরি",                      en: "Category" },
  "localdata.required_err":   { bn: "লেবেল ও মান আবশ্যক",            en: "Label and value required" },
  "localdata.saving":         { bn: "সংরক্ষণ হচ্ছে...",               en: "Saving..." },
  "localdata.save_btn":       { bn: "সংরক্ষণ করুন",                   en: "Save" },
  "localdata.filter_all":     { bn: "সব",                             en: "All" },
  "localdata.add_btn":        { bn: "নতুন ডেটা যোগ করুন",             en: "Add New Data" },
  "localdata.items_suffix":   { bn: "টি আইটেম",                       en: " Items" },
  "localdata.empty":          { bn: "কোনো ডেটা নেই",                  en: "No data" },
  "localdata.empty_desc":     { bn: "উপরের বোতামে ক্লিক করে ডেটা যোগ করুন", en: "Click the button above to add data" },

  // ── Float Sheet toasts ───────────────────────────────────────
  "float.err_sheet_id":       { bn: "⚠️ Sheet Link বা ID দিন",        en: "⚠️ Enter Sheet Link or ID" },
  "float.err_sheet_invalid":  { bn: "⚠️ সঠিক Sheet URL বা ID দিন",    en: "⚠️ Enter a valid Sheet URL or ID" },
  "float.err_webapp":         { bn: "⚠️ Web App URL দিন",             en: "⚠️ Enter Web App URL" },
  "float.err_webapp_invalid": { bn: "⚠️ সঠিক Apps Script URL দিন",   en: "⚠️ Enter a valid Apps Script URL" },
  "float.err_columns":        { bn: "⚠️ Column লিখুন (যেমন A,B,C)",   en: "⚠️ Enter columns (e.g. A,B,C)" },
  "float.toast_saved":        { bn: "✅ সেটআপ সেভ হয়েছে!",            en: "✅ Setup saved!" },
  "float.toast_saved_desc":   { bn: "কনফিগারেশন সফলভাবে সংরক্ষিত হয়েছে", en: "Configuration saved successfully" },
  "float.save_first":         { bn: "আগে Save করুন",                  en: "Save First" },
  "float.save_first_desc":    { bn: "প্রথমে SAVE & CONFIGURE করুন",    en: "Please SAVE & CONFIGURE first" },
  "float.overlay_title":      { bn: "Overlay Permission দিন",         en: "Grant Overlay Permission" },
  "float.overlay_desc":       { bn: "Settings থেকে Display over other apps Allow করুন", en: "Allow 'Display over other apps' in Settings" },
  "float.bubble_fail":        { bn: "Bubble চালু হয়নি",               en: "Bubble failed to start" },
  "float.bubble_fail_desc":   { bn: "Overlay permission allow করুন",  en: "Allow overlay permission" },
  "float.bubble_started":     { bn: "▶ Floating Bubble চালু হয়েছে",   en: "▶ Floating Bubble started" },
  "float.bubble_started_desc":{ bn: "যেকোনো পেজে bubble দেখা যাবে",  en: "Bubble visible on any page" },
  "float.bubble_stopped":     { bn: "⏹ সার্ভিস বন্ধ হয়েছে",           en: "⏹ Service stopped" },

  // ── Notification time ────────────────────────────────────────
  "notif.time_left_suffix":   { bn: " বাকি",                          en: " left" },
  "notif.expired":            { bn: "মেয়াদ শেষ",                      en: "Expired" },
};

export function getLang(): Lang {
  try { return (localStorage.getItem(LANG_KEY) as Lang) || "en"; }
  catch { return "en"; }
}

export function setLang(lang: Lang): void {
  try { localStorage.setItem(LANG_KEY, lang); }
  catch {}
  window.dispatchEvent(new Event("xenox_lang_change"));
}

export function t(key: string, lang?: Lang): string {
  const l = lang ?? getLang();
  return T[key]?.[l] ?? T[key]?.bn ?? key;
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(getLang);
  useEffect(() => {
    const handler = () => setLangState(getLang());
    window.addEventListener("xenox_lang_change", handler);
    return () => window.removeEventListener("xenox_lang_change", handler);
  }, []);
  const change = (l: Lang) => { setLang(l); setLangState(l); };
  return [lang, change];
}

export function timeAgo(dateStr: string, lang?: Lang): string {
  const l = lang ?? getLang();
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return l === "en" ? "just now" : "এইমাত্র";
  if (mins < 60) return l === "en" ? `${mins} min ago` : `${mins} মিনিট আগে`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return l === "en" ? `${hrs}h ago` : `${hrs} ঘণ্টা আগে`;
  return l === "en" ? `${Math.floor(hrs / 24)}d ago` : `${Math.floor(hrs / 24)} দিন আগে`;
}
