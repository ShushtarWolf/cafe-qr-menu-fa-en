import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed, Plus, QrCode, ExternalLink, Trash2, GripVertical, Pencil,
  Star, EyeOff, Eye, Copy, Settings as SettingsIcon, LogOut, X, Check,
  Image as ImageIcon, Download, Store, Palette, Loader2
} from 'lucide-react';
import { api, centsToInput, inputToCents, inputToToman, moneyEn, moneyFa } from './api.js';

const TAGS = [
  { id: 'vegan', label: '🌱 وگان' },
  { id: 'gf', label: '🌾 بدون گلوتن' },
  { id: 'spicy', label: '🌶️ تند' }
];

function Button({ children, onClick, variant = 'primary', className = '', ...rest }) {
  const styles = {
    primary: 'bg-accent-500 hover:bg-accent-400 text-ink-950 font-semibold',
    ghost: 'bg-ink-900 hover:bg-ink-800 text-stone-200 border border-ink-800',
    danger: 'bg-red-950/60 hover:bg-red-900/70 text-red-300 border border-red-900/60'
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`bg-ink-900 border border-ink-800 rounded-xl px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 outline-none focus:border-accent-500/60 w-full ${props.className || ''}`}
    />
  );
}

function FieldLabel({ children }) {
  return <span className="text-xs text-stone-500 block mb-1">{children}</span>;
}

function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 cursor-pointer select-none"
      title={label}
    >
      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${on ? 'bg-accent-500' : 'bg-ink-700'}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm text-stone-300">{label}</span>}
    </button>
  );
}

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.login(pw);
      onDone();
    } catch {
      setErr('رمز عبور اشتباه است');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen grid place-items-center p-6" dir="rtl">
      <motion.form
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="w-full max-w-sm bg-ink-900 border border-ink-800 rounded-2xl p-8 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent-500 grid place-items-center">
            <UtensilsCrossed className="w-6 h-6 text-ink-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold">پنل منوی کافه</h1>
            <p className="text-xs text-stone-500">منوی دو زبانه فارسی / انگلیسی</p>
          </div>
        </div>
        <Input
          type="password"
          placeholder="رمز ادمین"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button className="w-full justify-center" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ورود'}
        </Button>
      </motion.form>
    </div>
  );
}

function ItemModal({ item, categoryId, onClose, onSaved }) {
  const isNew = !item?.id;
  const [form, setForm] = useState({
    name: item?.name || '',
    name_fa: item?.name_fa || '',
    description: item?.description || '',
    description_fa: item?.description_fa || '',
    price: item ? centsToInput(item.price_cents) : '',
    price_fa: item ? String(item.price_fa || 0) : '',
    tags: item ? JSON.parse(item.tags_json || '[]') : [],
    in_stock: item ? !!item.in_stock : true,
    is_special: item ? !!item.is_special : false
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const save = async () => {
    if (!form.name.trim() && !form.name_fa.trim()) return setErr('نام فارسی یا انگلیسی الزامی است');
    setBusy(true);
    setErr('');
    try {
      const body = {
        name: form.name,
        name_fa: form.name_fa,
        description: form.description,
        description_fa: form.description_fa,
        price_cents: inputToCents(form.price),
        price_fa: inputToToman(form.price_fa),
        tags: form.tags,
        in_stock: form.in_stock,
        is_special: form.is_special
      };
      let saved = isNew ? await api.createItem(categoryId, body) : await api.updateItem(item.id, body);
      const file = fileRef.current?.files?.[0];
      if (file) saved = await api.uploadPhoto(saved.id, file);
      onSaved(saved);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="bg-ink-900 border border-ink-800 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{isNew ? 'آیتم جدید' : 'ویرایش آیتم'}</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>نام فارسی</FieldLabel>
            <Input placeholder="مثلاً لاته" value={form.name_fa} onChange={(e) => setForm({ ...form, name_fa: e.target.value })} autoFocus />
          </div>
          <div>
            <FieldLabel>Name (English)</FieldLabel>
            <Input dir="ltr" placeholder="e.g. Latte" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>قیمت (تومان)</FieldLabel>
            <Input dir="ltr" placeholder="85000" inputMode="numeric" value={form.price_fa} onChange={(e) => setForm({ ...form, price_fa: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Price (USD)</FieldLabel>
            <Input dir="ltr" placeholder="0.00" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
        </div>

        <div>
          <FieldLabel>توضیح فارسی</FieldLabel>
          <textarea
            placeholder="اختیاری"
            value={form.description_fa}
            onChange={(e) => setForm({ ...form, description_fa: e.target.value })}
            rows={2}
            className="bg-ink-950 border border-ink-800 rounded-xl px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 outline-none focus:border-accent-500/60 w-full resize-none"
          />
        </div>
        <div>
          <FieldLabel>Description (English)</FieldLabel>
          <textarea
            dir="ltr"
            placeholder="Optional"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="bg-ink-950 border border-ink-800 rounded-xl px-3.5 py-2 text-sm text-stone-100 placeholder-stone-500 outline-none focus:border-accent-500/60 w-full resize-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const on = form.tags.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setForm({ ...form, tags: on ? form.tags.filter((x) => x !== t.id) : [...form.tags, t.id] })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                  on ? 'bg-accent-500 text-ink-950 border-accent-500' : 'bg-ink-950 text-stone-400 border-ink-800 hover:border-ink-700'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-6">
          <Toggle on={form.in_stock} onChange={(v) => setForm({ ...form, in_stock: v })} label="موجود" />
          <Toggle on={form.is_special} onChange={(v) => setForm({ ...form, is_special: v })} label="ویژه ★" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-400 cursor-pointer hover:text-stone-200">
            <ImageIcon className="w-4 h-4" />
            <span>عکس</span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" />
          </label>
          {item?.photo_path && <img src={item.photo_path} alt="" className="w-10 h-10 rounded-lg object-cover" />}
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} ذخیره
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QrPanel({ venue }) {
  const menuUrl = `${window.location.origin}/m/${venue.slug}`;
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><QrCode className="w-4 h-4 text-accent-500" /> کد QR</h3>
      <div className="bg-white rounded-xl p-3 w-fit mx-auto">
        <img src={`/api/venues/${venue.id}/qr.png?size=280&t=${venue.slug}`} alt="Menu QR" className="w-44 h-44" />
      </div>
      <a href={menuUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-accent-400 hover:text-accent-500 break-all" dir="ltr">
        <ExternalLink className="w-4 h-4 shrink-0" /> {menuUrl}
      </a>
      <div className="grid grid-cols-2 gap-2">
        <a href={`/api/venues/${venue.id}/qr.png?size=1024`} download={`${venue.slug}-qr.png`}>
          <Button variant="ghost" className="w-full justify-center"><Download className="w-4 h-4" /> PNG</Button>
        </a>
        <a href={`/api/venues/${venue.id}/table-tent.pdf`} download>
          <Button variant="ghost" className="w-full justify-center"><Download className="w-4 h-4" /> کارت میز</Button>
        </a>
      </div>
    </div>
  );
}

function BrandingPanel({ venue, onUpdated }) {
  const b = venue.branding || {};
  const logoRef = useRef(null);
  const set = async (patch) => onUpdated(await api.updateVenue(venue.id, { branding: { ...b, ...patch } }));
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><Palette className="w-4 h-4 text-accent-500" /> برندینگ</h3>
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-400">تم</span>
        <div className="flex rounded-xl overflow-hidden border border-ink-800">
          {[['dark', 'تاریک'], ['light', 'روشن']].map(([t, label]) => (
            <button
              key={t}
              onClick={() => set({ theme: t })}
              className={`px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                (b.theme || 'dark') === t ? 'bg-accent-500 text-ink-950' : 'bg-ink-950 text-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-400">رنگ تاکید</span>
        <input
          type="color"
          value={b.accent || '#f59e0b'}
          onChange={(e) => set({ accent: e.target.value })}
          className="w-9 h-9 rounded-lg bg-transparent border border-ink-800 cursor-pointer"
        />
      </div>
      <div>
        <FieldLabel>شعار فارسی</FieldLabel>
        <Input
          defaultValue={b.tagline_fa || ''}
          placeholder="تازه، محلی، مخصوص شما"
          onBlur={(e) => e.target.value !== (b.tagline_fa || '') && set({ tagline_fa: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel>Tagline (English)</FieldLabel>
        <Input
          dir="ltr"
          defaultValue={b.tagline || ''}
          placeholder="Fresh, local, made to order"
          onBlur={(e) => e.target.value !== (b.tagline || '') && set({ tagline: e.target.value })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-400">لوگو</span>
        <div className="flex items-center gap-2">
          {b.logo_path && <img src={b.logo_path} alt="logo" className="w-9 h-9 rounded-lg object-cover" />}
          <Button variant="ghost" onClick={() => logoRef.current?.click()}><ImageIcon className="w-4 h-4" /> آپلود</Button>
          <input
            ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) onUpdated({ ...(await api.uploadLogo(venue.id, f)), categories: venue.categories });
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-ink-800">
        <span className="text-sm text-stone-400 flex items-center gap-1.5"><Star className="w-4 h-4 text-accent-500" /> بخش ویژه‌ها</span>
        <Toggle
          on={!!venue.specials_enabled}
          onChange={async (v) => onUpdated(await api.updateVenue(venue.id, { specials_enabled: v }))}
        />
      </div>
      <div className="pt-1 border-t border-ink-800 space-y-2">
        <FieldLabel>نام کافه (فارسی / English)</FieldLabel>
        <Input
          defaultValue={venue.name_fa || ''}
          placeholder="نام فارسی"
          onBlur={async (e) => {
            if (e.target.value !== (venue.name_fa || '')) {
              onUpdated(await api.updateVenue(venue.id, { name_fa: e.target.value }));
            }
          }}
        />
        <Input
          dir="ltr"
          defaultValue={venue.name || ''}
          placeholder="English name"
          onBlur={async (e) => {
            if (e.target.value !== (venue.name || '')) {
              onUpdated(await api.updateVenue(venue.id, { name: e.target.value }));
            }
          }}
        />
      </div>
    </div>
  );
}

function ItemRow({ item, onEdit, onChanged, onDelete, dragProps }) {
  const tags = JSON.parse(item.tags_json || '[]');
  const title = item.name_fa || item.name;
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-ink-950 border border-ink-800 group ${
        item.in_stock ? '' : 'opacity-50'
      }`}
      {...dragProps}
    >
      <GripVertical className="w-4 h-4 text-stone-600 cursor-grab shrink-0" />
      {item.photo_path
        ? <img src={item.photo_path} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
        : <div className="w-9 h-9 rounded-lg bg-ink-900 grid place-items-center shrink-0"><ImageIcon className="w-4 h-4 text-stone-700" /></div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{title}</span>
          {!!item.is_special && <Star className="w-3.5 h-3.5 text-accent-500 fill-accent-500 shrink-0" />}
          {tags.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-900 text-stone-500 shrink-0">{t}</span>
          ))}
        </div>
        <p className="text-xs text-stone-500 truncate" dir="ltr">
          {moneyFa(item.price_fa)} · {moneyEn(item.price_cents)}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          title={item.in_stock ? 'مخفی از منو' : 'موجود کردن'}
          onClick={async () => onChanged(await api.updateItem(item.id, { in_stock: !item.in_stock }))}
          className="p-1.5 rounded-lg hover:bg-ink-800 cursor-pointer text-stone-400"
        >
          {item.in_stock ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-ink-800 cursor-pointer text-stone-400">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg hover:bg-red-950 cursor-pointer text-stone-400 hover:text-red-400">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CategoryBlock({ cat, onReload }) {
  const [modal, setModal] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(cat.name);
  const [nameFa, setNameFa] = useState(cat.name_fa || '');
  const dragIndex = useRef(null);

  const itemDrag = (idx) => ({
    draggable: true,
    onDragStart: () => { dragIndex.current = idx; },
    onDragOver: (e) => e.preventDefault(),
    onDrop: async (e) => {
      e.preventDefault();
      const from = dragIndex.current;
      if (from === null || from === idx) return;
      const ids = cat.items.map((i) => i.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(idx, 0, moved);
      await api.reorderItems(cat.id, ids);
      onReload();
    }
  });

  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        {renaming ? (
          <form
            className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api.updateCategory(cat.id, { name, name_fa: nameFa });
              setRenaming(false);
              onReload();
            }}
          >
            <Input placeholder="نام فارسی" value={nameFa} onChange={(e) => setNameFa(e.target.value)} autoFocus />
            <Input dir="ltr" placeholder="English" value={name} onChange={(e) => setName(e.target.value)} />
            <Button><Check className="w-4 h-4" /></Button>
          </form>
        ) : (
          <>
            <h3 className="font-bold flex-1">{cat.name_fa || cat.name}</h3>
            <button onClick={() => setRenaming(true)} className="p-1.5 rounded-lg hover:bg-ink-800 cursor-pointer text-stone-500">
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                if (confirm(`دسته «${cat.name_fa || cat.name}» و ${cat.items.length} آیتم حذف شوند؟`)) {
                  await api.deleteCategory(cat.id);
                  onReload();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-950 cursor-pointer text-stone-500 hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      <div className="space-y-1.5">
        {cat.items.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            dragProps={itemDrag(idx)}
            onEdit={(i) => setModal({ item: i })}
            onChanged={onReload}
            onDelete={async (i) => {
              if (confirm(`«${i.name_fa || i.name}» حذف شود؟`)) { await api.deleteItem(i.id); onReload(); }
            }}
          />
        ))}
      </div>
      <button
        onClick={() => setModal({ item: null })}
        className="w-full py-2 rounded-xl border border-dashed border-ink-700 text-stone-500 text-sm hover:border-accent-500/50 hover:text-accent-400 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> افزودن آیتم
      </button>
      <AnimatePresence>
        {modal && (
          <ItemModal
            item={modal.item}
            categoryId={cat.id}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); onReload(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function VenueEditor({ venueId, venues, onVenuesChanged }) {
  const [venue, setVenue] = useState(null);
  const [newCat, setNewCat] = useState('');
  const [newCatFa, setNewCatFa] = useState('');
  const [dupTarget, setDupTarget] = useState('');
  const catDragIndex = useRef(null);

  const reload = useCallback(async () => setVenue(await api.venue(venueId)), [venueId]);
  useEffect(() => { reload(); }, [reload]);

  if (!venue) return <div className="grid place-items-center h-64"><Loader2 className="w-6 h-6 animate-spin text-stone-600" /></div>;

  const catDrag = (idx) => ({
    draggable: true,
    onDragStart: () => { catDragIndex.current = idx; },
    onDragOver: (e) => e.preventDefault(),
    onDrop: async (e) => {
      e.preventDefault();
      const from = catDragIndex.current;
      if (from === null || from === idx) return;
      const ids = venue.categories.map((c) => c.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(idx, 0, moved);
      await api.reorderCategories(venue.id, ids);
      reload();
    }
  });

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-4 min-w-0">
        {venue.categories.map((cat, idx) => (
          <div key={cat.id} {...catDrag(idx)}>
            <CategoryBlock cat={cat} onReload={reload} />
          </div>
        ))}
        <form
          className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newCat.trim() && !newCatFa.trim()) return;
            await api.createCategory(venue.id, { name: newCat.trim(), name_fa: newCatFa.trim() });
            setNewCat('');
            setNewCatFa('');
            reload();
          }}
        >
          <Input placeholder="دسته فارسی (نوشیدنی…)" value={newCatFa} onChange={(e) => setNewCatFa(e.target.value)} />
          <Input dir="ltr" placeholder="Category (Drinks…)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button><Plus className="w-4 h-4" /> دسته</Button>
        </form>
      </div>

      <div className="space-y-4">
        <QrPanel venue={venue} />
        <BrandingPanel venue={venue} onUpdated={(v) => setVenue({ ...venue, ...v })} />
        {venues.length > 1 && (
          <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold flex items-center gap-2"><Copy className="w-4 h-4 text-accent-500" /> کپی منو به…</h3>
            <p className="text-xs text-stone-500">منو را به شعبه دیگر کپی کنید و جداگانه ویرایش کنید.</p>
            <select
              value={dupTarget}
              onChange={(e) => setDupTarget(e.target.value)}
              className="bg-ink-950 border border-ink-800 rounded-xl px-3 py-2 text-sm w-full outline-none"
            >
              <option value="">انتخاب شعبه…</option>
              {venues.filter((v) => v.id !== venue.id).map((v) => (
                <option key={v.id} value={v.id}>{v.name_fa || v.name}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              className="w-full justify-center"
              disabled={!dupTarget}
              onClick={async () => {
                if (confirm('منوی مقصد جایگزین می‌شود. ادامه؟')) {
                  await api.duplicateMenu(venue.id, Number(dupTarget));
                  setDupTarget('');
                  onVenuesChanged();
                  alert('منو کپی شد.');
                }
              }}
            >
              <Copy className="w-4 h-4" /> کپی منو
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsModal({ onClose }) {
  const [s, setS] = useState(null);
  useEffect(() => { api.settings().then(setS); }, []);
  if (!s) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-ink-900 border border-ink-800 rounded-2xl p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()} dir="rtl">
        <h3 className="font-bold">تنظیمات</h3>
        <div>
          <FieldLabel>آدرس عمومی (برای QR)</FieldLabel>
          <Input dir="ltr" value={s.base_url} placeholder={window.location.origin}
            onChange={(e) => setS({ ...s, base_url: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>واحد پول فارسی</FieldLabel>
            <Input value={s.currency_symbol_fa || 'تومان'} onChange={(e) => setS({ ...s, currency_symbol_fa: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Currency (EN)</FieldLabel>
            <Input dir="ltr" value={s.currency_symbol || '$'} onChange={(e) => setS({ ...s, currency_symbol: e.target.value })} />
          </div>
        </div>
        <div>
          <FieldLabel>زبان پیش‌فرض منوی عمومی</FieldLabel>
          <select
            value={s.default_lang || 'fa'}
            onChange={(e) => setS({ ...s, default_lang: e.target.value })}
            className="bg-ink-950 border border-ink-800 rounded-xl px-3 py-2 text-sm w-full outline-none"
          >
            <option value="fa">فارسی</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          <Button onClick={async () => { await api.saveSettings(s); onClose(); }}><Check className="w-4 h-4" /> ذخیره</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [venues, setVenues] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [newVenue, setNewVenue] = useState('');
  const [newVenueFa, setNewVenueFa] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const loadVenues = useCallback(async () => {
    const vs = await api.venues();
    setVenues(vs);
    setActiveId((cur) => (cur && vs.some((v) => v.id === cur) ? cur : vs[0]?.id ?? null));
  }, []);

  useEffect(() => {
    api.me()
      .then(() => { setAuthed(true); loadVenues(); })
      .catch(() => setAuthed(false));
  }, [loadVenues]);

  if (authed === null) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-stone-600" /></div>;
  if (!authed) return <Login onDone={() => { setAuthed(true); loadVenues(); }} />;

  const active = venues.find((v) => v.id === activeId);

  return (
    <div className="min-h-screen" dir="rtl">
      <header className="border-b border-ink-800 bg-ink-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-500 grid place-items-center">
            <UtensilsCrossed className="w-4.5 h-4.5 text-ink-950" />
          </div>
          <span className="font-bold">پنل منو</span>
          <span className="text-xs text-stone-600 hidden sm:block">فارسی · English · دو واحد پول</span>
          <div className="flex-1" />
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg hover:bg-ink-900 cursor-pointer text-stone-400">
            <SettingsIcon className="w-4.5 h-4.5" />
          </button>
          <button onClick={async () => { await api.logout(); setAuthed(false); }} className="p-2 rounded-lg hover:bg-ink-900 cursor-pointer text-stone-400">
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {venues.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveId(v.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                v.id === activeId
                  ? 'bg-accent-500 text-ink-950 border-accent-500'
                  : 'bg-ink-900 text-stone-300 border-ink-800 hover:border-ink-700'
              }`}
            >
              <Store className="w-4 h-4" /> {v.name_fa || v.name}
              <span className={`text-[10px] ${v.id === activeId ? 'text-ink-950/70' : 'text-stone-600'}`}>{v.item_count}</span>
            </button>
          ))}
          <form
            className="flex gap-2 flex-wrap"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newVenue.trim() && !newVenueFa.trim()) return;
              const v = await api.createVenue({ name: newVenue.trim(), name_fa: newVenueFa.trim() });
              setNewVenue('');
              setNewVenueFa('');
              await loadVenues();
              setActiveId(v.id);
            }}
          >
            <Input placeholder="نام فارسی…" value={newVenueFa} onChange={(e) => setNewVenueFa(e.target.value)} className="!w-36" />
            <Input dir="ltr" placeholder="English…" value={newVenue} onChange={(e) => setNewVenue(e.target.value)} className="!w-36" />
            <Button variant="ghost"><Plus className="w-4 h-4" /></Button>
          </form>
          {active && venues.length > 1 && (
            <Button
              variant="danger"
              onClick={async () => {
                if (confirm(`شعبه «${active.name_fa || active.name}» و کل منو حذف شود؟`)) {
                  await api.deleteVenue(active.id);
                  loadVenues();
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {active ? (
          <VenueEditor key={active.id} venueId={active.id} venues={venues} onVenuesChanged={loadVenues} />
        ) : (
          <div className="text-center py-24 text-stone-500">
            <Store className="w-10 h-10 mx-auto mb-3 text-stone-700" />
            <p>اولین شعبه را بسازید تا منو را شروع کنید.</p>
          </div>
        )}
      </main>

      <AnimatePresence>{showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}</AnimatePresence>
    </div>
  );
}
