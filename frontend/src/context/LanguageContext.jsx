import { createContext, useContext, useEffect, useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";

const translations = {
  en: {
    suggestions: "Suggestions",
    verified: "Verified account",
    unverifiedWarning: "Warning: This is an untrusted/unverified user. Interact and trust at your own risk.",
    getVerified: "Get verified",
    boostPost: "Boost post",
    verifyEmailOnly: "Verify your email",
    monthlySubscription: "Monthly subscription",
    oneWeek: "1 Week",
    oneMonth: "1 Month",
    discountedOffer: "Discounted Offer",
    transferMethod: "Transfer method",
    transferReference: "Transfer reference",
    submitReview: "Submit for manual review",
    addFriend: "Add friend",
    loadingSuggestions: "Loading suggestions...",
    noSuggestions: "No suggestions right now.",
    graceRemaining: "Grace period remaining",
    verifiedThrough: "Your account is verified through",
    verifiedDuringGrace: "Your subscription expired on",
    gracePeriodBadge: "Your verified badge remains active during the grace period.",
    renewAfterExpiry: "Your subscription has expired. Submit a payment request to renew it.",
    verifiedIndefinitely: "Your account is verified.",
    days: "days",
    hours: "hours",
    sadapayPaymentTitle: "Pay using SadaPay",
    sadapayOnly: "Send the exact amount to this SadaPay account. Other payment destinations are not accepted for verification.",
    accountName: "Account name",
    accountNumber: "Account number",
    sadapayUnavailable: "SadaPay payment details are not configured yet. Contact support; do not send a payment until the account details are displayed.",
    reviewWindow: "Requests remain pending during review, which can take up to 24 hours.",
    transferApp: "Transfer app",
    selectTransferApp: "Select the app you used",
    senderName: "Sender name",
    receiptImage: "Payment receipt image",
    receiptRequirements: "JPG, PNG, or WebP; maximum 5 MB.",
    voiceNote: "Record voice note",
    stopRecording: "Stop recording",
    voiceUnsupported: "Voice recording is not supported on this device or browser.",
    microphoneDenied: "Microphone access was denied or unavailable.",
    recordingFailed: "Voice recording failed. Check microphone access and try again.",
    voiceSizeError: "Voice notes must be 10 MB or smaller.",
    voiceSendFailed: "Voice note could not be sent.",
    call: "Call",
    incomingCall: "Incoming audio call",
    answerCall: "Answer",
    declineCall: "Decline",
    callConnected: "Call connected",
    calling: "Calling...",
    mute: "Mute",
    unmute: "Unmute",
    endCall: "End call",
  },
  ur: {
    suggestions: "تجاویز",
    verified: "تصدیق شدہ اکاؤنٹ",
    unverifiedWarning: "انتباہ: یہ غیر معتبر/غیر تصدیق شدہ صارف ہے۔ اپنی ذمہ داری پر رابطہ کریں۔",
    getVerified: "تصدیق حاصل کریں",
    boostPost: "پوسٹ کو فروغ دیں",
    verifyEmailOnly: "اپنی ای میل کی تصدیق کریں",
    monthlySubscription: "ماہانہ سبسکرپشن",
    oneWeek: "ایک ہفتہ",
    oneMonth: "ایک مہینہ",
    discountedOffer: "خصوصی رعایت",
    transferMethod: "ٹرانسفر کا طریقہ",
    transferReference: "ٹرانسفر حوالہ",
    submitReview: "دستی جانچ کے لیے جمع کریں",
    addFriend: "دوست بنائیں",
    loadingSuggestions: "تجاویز لوڈ ہو رہی ہیں...",
    noSuggestions: "فی الحال کوئی تجاویز نہیں ہیں۔",
    graceRemaining: "مہلت کے باقی وقت",
    verifiedThrough: "آپ کا اکاؤنٹ اس تاریخ تک تصدیق شدہ ہے:",
    verifiedDuringGrace: "آپ کی سبسکرپشن اس تاریخ کو ختم ہوئی:",
    gracePeriodBadge: "مہلت کے دوران آپ کا تصدیقی بیج فعال رہے گا۔",
    renewAfterExpiry: "آپ کی سبسکرپشن ختم ہو گئی ہے۔ تجدید کے لیے ادائیگی کی درخواست جمع کریں۔",
    verifiedIndefinitely: "آپ کا اکاؤنٹ تصدیق شدہ ہے۔",
    days: "دن",
    hours: "گھنٹے",
    sadapayPaymentTitle: "SadaPay کے ذریعے ادائیگی کریں",
    sadapayOnly: "درست رقم اس SadaPay اکاؤنٹ میں بھیجیں۔ تصدیق کے لیے کسی دوسرے ادائیگی اکاؤنٹ میں رقم نہ بھیجیں۔",
    accountName: "اکاؤنٹ کا نام",
    accountNumber: "اکاؤنٹ نمبر",
    sadapayUnavailable: "SadaPay کی ادائیگی کی تفصیلات ابھی ترتیب نہیں دی گئیں۔ اکاؤنٹ کی تفصیلات ظاہر ہونے تک ادائیگی نہ کریں اور سپورٹ سے رابطہ کریں۔",
    reviewWindow: "درخواست جانچ کے دوران زیر التوا رہے گی، جس میں 24 گھنٹے لگ سکتے ہیں۔",
    transferApp: "رقم بھیجنے والی ایپ",
    selectTransferApp: "استعمال کی گئی ایپ منتخب کریں",
    senderName: "بھیجنے والے کا نام",
    receiptImage: "ادائیگی کی رسید کی تصویر",
    receiptRequirements: "JPG، PNG یا WebP؛ زیادہ سے زیادہ 5 MB۔",
    voiceNote: "آواز کا پیغام ریکارڈ کریں",
    stopRecording: "ریکارڈنگ روکیں",
    voiceUnsupported: "اس ڈیوائس یا براؤزر پر آواز ریکارڈ نہیں کی جا سکتی۔",
    microphoneDenied: "مائیکروفون کی اجازت نہیں ملی یا یہ دستیاب نہیں ہے۔",
    recordingFailed: "آواز ریکارڈ نہیں ہو سکی۔ مائیکروفون کی اجازت چیک کریں اور دوبارہ کوشش کریں۔",
    voiceSizeError: "آواز کے پیغام کا سائز 10 MB یا اس سے کم ہونا چاہیے۔",
    voiceSendFailed: "آواز کا پیغام نہیں بھیجا جا سکا۔",
    call: "کال کریں",
    incomingCall: "آڈیو کال آ رہی ہے",
    answerCall: "جواب دیں",
    declineCall: "مسترد کریں",
    callConnected: "کال منسلک ہے",
    calling: "کال جاری ہے...",
    mute: "خاموش کریں",
    unmute: "آواز کھولیں",
    endCall: "کال ختم کریں",
  },
};

function getDetectedLanguage() {
  const locale = navigator.language || "";
  const region = locale.split("-")[1]?.toUpperCase();
  return locale.toLowerCase().startsWith("ur") || region === "PK" ? "ur" : "en";
}

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (key) => translations.en[key] || key,
});

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [language, updateLanguage] = useState(
    () => localStorage.getItem("ricehub-language") || getDetectedLanguage()
  );
  const setLanguage = (nextLanguage) => {
    updateLanguage(nextLanguage);
    localStorage.setItem("ricehub-language-manual", "true");
  };

  useEffect(() => {
    if (
      user?.preferred_language
      && localStorage.getItem("ricehub-language-manual") !== "true"
    ) {
      updateLanguage(user.preferred_language);
    }
  }, [user?.preferred_language]);

  useEffect(() => {
    localStorage.setItem("ricehub-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key) => translations[language]?.[key] || translations.en[key] || key,
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
