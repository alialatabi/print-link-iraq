import {
  CreditCard, Briefcase, Folder, FolderArchive, ReceiptText, Pen, Stamp, Sticker,
  Tag, Scroll, UtensilsCrossed, FileText, Presentation, Gift, Frame, Stethoscope,
  Mail, Newspaper, BookOpen, Flag, type LucideIcon,
} from 'lucide-react';

// Unified, contextual icon set for services/subservices. The DB icons are an inconsistent
// mix of emojis (and the odd uploaded image); this maps each service to a single lucide
// line-icon family so every card reads the same. Match by known slug id first, then by an
// Arabic keyword in the label (covers admin-added services with generated UUID ids), then
// fall back to a neutral document icon.

const BY_ID: Record<string, LucideIcon> = {
  // cards
  cards: CreditCard, business_card: CreditCard, vip_card: CreditCard,
  // office / folders / receipts
  office: Briefcase, file_folder: Folder, master_folder: FolderArchive,
  receipt_book: ReceiptText, receipt: ReceiptText, letterhead: FileText,
  // pens / stamps / stickers
  pen: Pen, stamp: Stamp, stamps: Stamp, sticker: Sticker, stickers: Sticker,
  // signage / large format
  hanging_sign: Tag, rollup: Scroll, banners: Presentation, flex: Frame,
  // food
  menu: UtensilsCrossed, menus: UtensilsCrossed,
  // misc
  promo: Gift, doctor_rx: Stethoscope, flyer: Newspaper, invitation: Mail,
};

const BY_KEYWORD: [RegExp, LucideIcon][] = [
  [/كارت|كرت|كروت/, CreditCard],
  [/منيو|قائمة|قوائم|طعام/, UtensilsCrossed],
  [/ختم|اختام|أختام/, Stamp],
  [/ستيكر|ملصق|لاصق/, Sticker],
  [/رول/, Scroll],
  [/فلكس/, Frame],
  [/لوحة|لوحات|اعلان|إعلان/, Presentation],
  [/وصل|دفتر/, ReceiptText],
  [/فايل|حافظة|فولدر/, Folder],
  [/قلم/, Pen],
  [/علاقة/, Tag],
  [/راجيتة|طبيب|وصفة/, Stethoscope],
  [/هدايا|هدية|دعائي/, Gift],
  [/فورما|ترويسة|ورق/, FileText],
  [/دعوة|دعوات/, Mail],
  [/فلاير|فلاي/, Newspaper],
  [/بروشور|كتيب/, BookOpen],
  [/راية|بنر/, Flag],
  [/مطبوعات|اداري|إداري/, Briefcase],
];

/** Returns a consistent lucide icon that represents the given service. */
export function getServiceIcon(service: { id?: string | null; label?: string | null }): LucideIcon {
  if (service.id && BY_ID[service.id]) return BY_ID[service.id];
  const label = service.label ?? '';
  for (const [re, icon] of BY_KEYWORD) if (re.test(label)) return icon;
  return FileText;
}
