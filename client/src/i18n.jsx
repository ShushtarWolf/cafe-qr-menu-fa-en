import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

const STORAGE_KEY = 'menuly_admin_lang';

export const TAGS = {
  fa: [
    { id: 'vegan', label: '🌱 وگان' },
    { id: 'gf', label: '🌾 بدون گلوتن' },
    { id: 'spicy', label: '🌶️ تند' }
  ],
  en: [
    { id: 'vegan', label: '🌱 Vegan' },
    { id: 'gf', label: '🌾 Gluten-free' },
    { id: 'spicy', label: '🌶️ Spicy' }
  ]
};

const fa = {
  dir: 'rtl',
  loginTitle: 'پنل منوی کافه',
  loginSub: 'مدیریت منوی دیجیتال',
  adminPassword: 'رمز ادمین',
  wrongPassword: 'رمز عبور اشتباه است',
  login: 'ورود',
  panelTitle: 'پنل منو',
  settings: 'تنظیمات',
  logout: 'خروج',
  langFa: 'فارسی',
  langEn: 'English',
  currencyHint: 'تومان',
  newItem: 'آیتم جدید',
  editItem: 'ویرایش آیتم',
  nameFa: 'نام فارسی',
  nameEn: 'نام انگلیسی',
  priceFa: 'قیمت (تومان)',
  priceEn: 'قیمت (دلار)',
  descFa: 'توضیح فارسی',
  descEn: 'توضیح انگلیسی',
  optional: 'اختیاری',
  inStock: 'موجود',
  special: 'ویژه ★',
  photo: 'عکس',
  cancel: 'انصراف',
  save: 'ذخیره',
  nameRequired: 'نام الزامی است',
  qrCode: 'کد QR',
  tableTent: 'کارت میز',
  branding: 'برندینگ',
  theme: 'تم',
  dark: 'تاریک',
  light: 'روشن',
  accent: 'رنگ تاکید',
  taglineFa: 'شعار فارسی',
  taglineEn: 'شعار انگلیسی',
  logo: 'لوگو',
  upload: 'آپلود',
  specialsSection: 'بخش ویژه‌ها',
  cafeNameFa: 'نام کافه (فارسی)',
  cafeNameEn: 'نام کافه (انگلیسی)',
  hideFromMenu: 'مخفی از منو',
  makeAvailable: 'موجود کردن',
  addItem: 'افزودن آیتم',
  deleteCategoryConfirm: (name, n) => `دسته «${name}» و ${n} آیتم حذف شوند؟`,
  deleteItemConfirm: (name) => `«${name}» حذف شود؟`,
  categoryFa: 'دسته فارسی (نوشیدنی…)',
  categoryEn: 'دسته انگلیسی (Drinks…)',
  addCategory: 'دسته',
  copyMenuTo: 'کپی منو به…',
  copyMenuHint: 'منو را به شعبه دیگر کپی کنید و جداگانه ویرایش کنید.',
  selectBranch: 'انتخاب شعبه…',
  copyMenu: 'کپی منو',
  copyConfirm: 'منوی مقصد جایگزین می‌شود. ادامه؟',
  copyDone: 'منو کپی شد.',
  settingsTitle: 'تنظیمات',
  publicUrl: 'آدرس عمومی (برای QR)',
  currencySymbolFa: 'واحد پول فارسی',
  currencySymbolEn: 'واحد پول انگلیسی',
  defaultPublicLang: 'زبان پیش‌فرض منوی عمومی',
  venueFaPlaceholder: 'نام فارسی…',
  venueEnPlaceholder: 'نام انگلیسی…',
  emptyVenues: 'اولین شعبه را بسازید تا منو را شروع کنید.',
  deleteVenueConfirm: (name) => `شعبه «${name}» و کل منو حذف شود؟`,
  taglineFaPlaceholder: 'تازه، محلی، مخصوص شما',
  taglineEnPlaceholder: 'Fresh, local, made to order',
  nameFaPlaceholder: 'مثلاً لاته',
  nameEnPlaceholder: 'e.g. Latte'
};

const en = {
  dir: 'ltr',
  loginTitle: 'Cafe menu admin',
  loginSub: 'Manage your digital menu',
  adminPassword: 'Admin password',
  wrongPassword: 'Wrong password',
  login: 'Sign in',
  panelTitle: 'Menu panel',
  settings: 'Settings',
  logout: 'Log out',
  langFa: 'فارسی',
  langEn: 'English',
  currencyHint: 'USD',
  newItem: 'New item',
  editItem: 'Edit item',
  nameFa: 'Farsi name',
  nameEn: 'English name',
  priceFa: 'Price (Toman)',
  priceEn: 'Price (USD)',
  descFa: 'Farsi description',
  descEn: 'English description',
  optional: 'Optional',
  inStock: 'In stock',
  special: 'Special ★',
  photo: 'Photo',
  cancel: 'Cancel',
  save: 'Save',
  nameRequired: 'A name is required',
  qrCode: 'QR code',
  tableTent: 'Table tent',
  branding: 'Branding',
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light',
  accent: 'Accent color',
  taglineFa: 'Farsi tagline',
  taglineEn: 'English tagline',
  logo: 'Logo',
  upload: 'Upload',
  specialsSection: 'Specials section',
  cafeNameFa: 'Cafe name (Farsi)',
  cafeNameEn: 'Cafe name (English)',
  hideFromMenu: 'Hide from menu',
  makeAvailable: 'Mark available',
  addItem: 'Add item',
  deleteCategoryConfirm: (name, n) => `Delete category “${name}” and ${n} items?`,
  deleteItemConfirm: (name) => `Delete “${name}”?`,
  categoryFa: 'Farsi category (e.g. نوشیدنی)',
  categoryEn: 'English category (Drinks…)',
  addCategory: 'Category',
  copyMenuTo: 'Copy menu to…',
  copyMenuHint: 'Copy this menu to another location and edit it separately.',
  selectBranch: 'Select location…',
  copyMenu: 'Copy menu',
  copyConfirm: 'The destination menu will be replaced. Continue?',
  copyDone: 'Menu copied.',
  settingsTitle: 'Settings',
  publicUrl: 'Public URL (for QR codes)',
  currencySymbolFa: 'Farsi currency',
  currencySymbolEn: 'English currency',
  defaultPublicLang: 'Default public menu language',
  venueFaPlaceholder: 'Farsi name…',
  venueEnPlaceholder: 'English name…',
  emptyVenues: 'Create your first location to start the menu.',
  deleteVenueConfirm: (name) => `Delete location “${name}” and its entire menu?`,
  taglineFaPlaceholder: 'تازه، محلی، مخصوص شما',
  taglineEnPlaceholder: 'Fresh, local, made to order',
  nameFaPlaceholder: 'مثلاً لاته',
  nameEnPlaceholder: 'e.g. Latte'
};

export const STRINGS = { fa, en };

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'en' ? 'en' : 'fa';
    } catch {
      return 'fa';
    }
  });

  const setLang = (next) => {
    const value = next === 'en' ? 'en' : 'fa';
    setLangState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = STRINGS[lang].dir;
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: STRINGS[lang],
      dir: STRINGS[lang].dir,
      isFa: lang === 'fa',
      tags: TAGS[lang]
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}

export function LangToggle({ className = '' }) {
  const { lang, setLang, t } = useLang();
  return (
    <div
      className={`inline-flex rounded-xl overflow-hidden border border-ink-800 ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang('fa')}
        className={`px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
          lang === 'fa' ? 'bg-accent-500 text-ink-950' : 'bg-ink-950 text-stone-400 hover:text-stone-200'
        }`}
      >
        {t.langFa} · تومان
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
          lang === 'en' ? 'bg-accent-500 text-ink-950' : 'bg-ink-950 text-stone-400 hover:text-stone-200'
        }`}
      >
        {t.langEn} · $
      </button>
    </div>
  );
}

export function displayName(entity, lang) {
  if (lang === 'fa') return entity.name_fa || entity.name || '';
  return entity.name || entity.name_fa || '';
}
