import { createContext, useContext, useEffect, useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";

const translations = {
  en: {
    suggestions: "Suggestions",
    findContacts: "Find accounts from contacts",
    contactsNotice: "Your address book is only accessed after you choose this button. Phone numbers are sent securely to find accounts and are not saved.",
    verified: "Verified account",
    unverifiedWarning: "Warning: This is an untrusted/unverified user. Interact and trust at your own risk.",
    getVerified: "Get verified",
    boostPost: "Boost post",
    manualPayments: "Payments are currently transfer-based and manually reviewed. Automatic billing is off.",
    verifyEmailPhone: "Verify your email and phone",
    sendSmsCode: "Send SMS code",
    verifyPhone: "Verify phone",
    monthlySubscription: "Monthly subscription",
    oneWeek: "1 Week",
    oneMonth: "1 Month",
    discountedOffer: "Discounted Offer",
    transferMethod: "Transfer method",
    transferReference: "Transfer reference",
    submitReview: "Submit for manual review",
    contactsCountry: "Country calling code for local contact numbers",
    addFriend: "Add friend",
    loadingSuggestions: "Loading suggestions...",
    noSuggestions: "No suggestions right now.",
    graceRemaining: "Grace period remaining",
    days: "days",
    hours: "hours",
  },
  ur: {
    suggestions: "تجاویز",
    findContacts: "رابطوں سے اکاؤنٹس تلاش کریں",
    contactsNotice: "آپ کی اجازت کے بعد ہی رابطوں تک رسائی ہوگی۔ اکاؤنٹس تلاش کرنے کے لیے فون نمبر محفوظ طریقے سے بھیجے جائیں گے اور محفوظ نہیں کیے جائیں گے۔",
    verified: "تصدیق شدہ اکاؤنٹ",
    unverifiedWarning: "انتباہ: یہ غیر معتبر/غیر تصدیق شدہ صارف ہے۔ اپنی ذمہ داری پر رابطہ کریں۔",
    getVerified: "تصدیق حاصل کریں",
    boostPost: "پوسٹ کو فروغ دیں",
    manualPayments: "ادائیگی فی الحال ٹرانسفر کے ذریعے اور دستی طور پر جانچی جاتی ہے۔ خودکار بلنگ بند ہے۔",
    verifyEmailPhone: "ای میل اور فون کی تصدیق کریں",
    sendSmsCode: "ایس ایم ایس کوڈ بھیجیں",
    verifyPhone: "فون کی تصدیق کریں",
    monthlySubscription: "ماہانہ سبسکرپشن",
    oneWeek: "ایک ہفتہ",
    oneMonth: "ایک مہینہ",
    discountedOffer: "خصوصی رعایت",
    transferMethod: "ٹرانسفر کا طریقہ",
    transferReference: "ٹرانسفر حوالہ",
    submitReview: "دستی جانچ کے لیے جمع کریں",
    contactsCountry: "مقامی رابطوں کے نمبروں کے لیے ملک کا کوڈ",
    addFriend: "دوست بنائیں",
    loadingSuggestions: "تجاویز لوڈ ہو رہی ہیں...",
    noSuggestions: "فی الحال کوئی تجاویز نہیں ہیں۔",
    graceRemaining: "مہلت کے باقی وقت",
    days: "دن",
    hours: "گھنٹے",
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
