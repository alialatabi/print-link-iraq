# مطبعتي (Matbaati) — Print Design Ordering Platform

> A full-stack Arabic (RTL) web application connecting customers with designers for print-ready designs (business cards, flyers, receipts, etc.). Built with React + Vite + Tailwind CSS + Lovable Cloud (Supabase).

**Live URL**: https://print-link-iraq.lovable.app

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Architecture & Data Flow](#architecture--data-flow)
5. [Authentication System](#authentication-system)
6. [Database Schema](#database-schema)
7. [Edge Functions (Backend)](#edge-functions-backend)
8. [Routing & Pages](#routing--pages)
9. [Contexts (Global State)](#contexts-global-state)
10. [Design System & Theming](#design-system--theming)
11. [Key Components](#key-components)
12. [Order Lifecycle](#order-lifecycle)
13. [Role-Based Access Control](#role-based-access-control)
14. [Cart System](#cart-system)
15. [Template Field Editor](#template-field-editor)
16. [Notifications](#notifications)
17. [Common Patterns](#common-patterns)
18. [Environment Variables](#environment-variables)
19. [Development Guide](#development-guide)

---

## Project Overview

**مطبعتي** is a 3-role platform:

| Role | Description |
|------|-------------|
| **Customer** (زبون) | Browses templates, fills in details, places orders, tracks progress |
| **Designer** (مصمم) | Receives assigned orders, uploads designs, manages revisions |
| **Admin** (مشرف) | Full control: manage orders, templates, users, assign designers, export data |

### Core Flow
```
Customer picks service → Selects template → Fills form → Submits order
    → Admin assigns designer → Designer uploads design
    → Customer approves → Print ready → Printed → Delivered
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS + shadcn/ui components |
| Animations | Framer Motion |
| Routing | React Router DOM v6 |
| State Management | React Context API |
| Server State | TanStack React Query |
| Backend / Auth / DB | Lovable Cloud (Supabase) |
| Edge Functions | Deno (Supabase Edge Functions) |
| Form Handling | React Hook Form + Zod |
| Icons | Lucide React |

---

## Directory Structure

```
├── public/                     # Static assets (favicon, robots.txt)
├── src/
│   ├── App.tsx                 # Root component with all route definitions
│   ├── main.tsx                # Entry point
│   ├── index.css               # Tailwind config + design tokens (HSL variables)
│   ├── components/
│   │   ├── Layout.tsx          # Main layout: header, nav, footer, mobile menu
│   │   ├── ProtectedRoute.tsx  # Auth guard with role checking
│   │   ├── NavLink.tsx         # Navigation link component
│   │   ├── NotificationBell.tsx# Real-time notification indicator
│   │   ├── StatusBadge.tsx     # Order status pill/badge
│   │   ├── DesignCanvasPreview.tsx # Live design preview with field overlays
│   │   ├── admin/
│   │   │   ├── AdminTemplates.tsx      # Template CRUD management
│   │   │   ├── AdminAccounts.tsx       # User role management
│   │   │   ├── AdminCustomers.tsx      # Customer list & details
│   │   │   └── TemplateFieldEditor.tsx # Visual field placement editor
│   │   └── ui/                 # shadcn/ui components (do not edit manually)
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Authentication state & phone login
│   │   ├── AppContext.tsx      # App-wide actions (order status updates)
│   │   └── CartContext.tsx     # Shopping cart with localStorage persistence
│   ├── data/
│   │   └── mockData.ts        # Type definitions, labels, constants, mock data
│   ├── hooks/
│   │   ├── use-mobile.tsx     # Mobile breakpoint detection
│   │   └── use-toast.ts       # Toast notification hook
│   ├── integrations/supabase/
│   │   ├── client.ts          # ⚠️ AUTO-GENERATED — do not edit
│   │   └── types.ts           # ⚠️ AUTO-GENERATED — do not edit
│   ├── lib/
│   │   ├── utils.ts           # cn() utility for className merging
│   │   ├── errors.ts          # User-friendly error messages
│   │   └── storage.ts         # Storage helpers
│   └── pages/
│       ├── Index.tsx           # Homepage: popular templates, how it works, features
│       ├── NotFound.tsx        # 404 page
│       ├── auth/
│       │   └── AuthPage.tsx    # Phone login / registration
│       ├── customer/
│       │   ├── ServiceSelection.tsx  # Browse service types
│       │   ├── TemplateSelection.tsx # Browse templates for a service
│       │   ├── TemplateDetails.tsx   # Single template view + add to cart
│       │   ├── OrderForm.tsx         # Fill design details + live preview
│       │   ├── CartPage.tsx          # Shopping cart
│       │   ├── CheckoutPage.tsx      # Checkout flow
│       │   ├── CompleteProfile.tsx   # Mandatory onboarding (address)
│       │   ├── OTPVerification.tsx   # OTP input page
│       │   ├── OrderSuccess.tsx      # Order confirmation
│       │   ├── OrderTracking.tsx     # Track single order status
│       │   ├── MyOrders.tsx          # All customer orders
│       │   └── ProfilePage.tsx       # Edit profile & address
│       ├── designer/
│       │   ├── DesignerLogin.tsx       # Designer-specific login
│       │   ├── DesignerOrders.tsx      # Designer dashboard with tabs
│       │   └── DesignerOrderDetails.tsx # Order details + design upload
│       └── admin/
│           └── AdminPanel.tsx  # Full admin dashboard (orders, users, templates, stats)
├── supabase/
│   ├── config.toml            # ⚠️ AUTO-GENERATED — edge function config
│   └── functions/
│       ├── phone-login/index.ts  # Phone-based auth (create/login user)
│       ├── send-otp/index.ts     # Generate & send OTP via WhatsApp
│       └── verify-otp/index.ts   # Verify OTP & create session
└── Configuration files
    ├── tailwind.config.ts     # Tailwind theme extensions
    ├── vite.config.ts         # Vite build config
    ├── tsconfig.json          # TypeScript config
    └── components.json        # shadcn/ui config
```

---

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│                                                   │
│  AuthContext ←→ AppContext ←→ CartContext         │
│       ↕              ↕              ↕             │
│  Auth Pages    Order Pages    Cart Pages          │
│       ↕              ↕              ↕             │
│  ┌──────────────────────────────────────────┐    │
│  │         Supabase JS Client               │    │
│  │   (src/integrations/supabase/client.ts)  │    │
│  └──────────────┬───────────────────────────┘    │
└─────────────────┼────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────┐
│              Lovable Cloud (Supabase)             │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Auth    │  │ Database │  │ Edge Functions │  │
│  │ (users) │  │ (tables) │  │ (Deno runtime) │  │
│  └─────────┘  └──────────┘  └────────────────┘  │
│                                                   │
│  Tables: profiles, orders, templates, designs,   │
│          notifications, otp_codes, user_roles    │
│                                                   │
│  Functions: phone-login, send-otp, verify-otp    │
└─────────────────────────────────────────────────┘
```

---

## Authentication System

### How It Works

Authentication is **phone-based** (no email/password from user's perspective):

1. **Customer enters phone number** on `/auth`
2. **Edge function `phone-login`** is called:
   - Normalizes phone (replaces leading `0` with `964` Iraq country code)
   - Creates a synthetic email: `{phone}@phone.matbaati.local`
   - Generates a deterministic password from the phone number
   - Tries to sign in → if fails, creates new user via admin API
   - Returns session tokens
3. **Client sets session** via `supabase.auth.setSession()`
4. **New users** are redirected to `/complete-profile` (mandatory address form)
5. **Existing users** go to homepage

### Key Files
- `src/contexts/AuthContext.tsx` — `phoneLogin()`, `signOut()`, role fetching
- `src/pages/auth/AuthPage.tsx` — Login UI
- `src/pages/customer/CompleteProfile.tsx` — Onboarding form
- `supabase/functions/phone-login/index.ts` — Backend auth logic

### Role Detection
After login, `AuthContext` queries `user_roles` table:
- If user has `admin` role → `role = 'admin'`
- If user has `designer` role → `role = 'designer'`
- Otherwise → `role = 'customer'`

### Password Field
The login form has an **optional** password field labeled "للمشرفين فقط" (Admins only). When provided, it's used as the actual password instead of the deterministic one. This allows admins/designers to have custom passwords.

---

## Database Schema

### Tables Overview

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User profile (name, phone, address) | Users read/update own; admins read all |
| `user_roles` | Role assignments (customer/designer/admin) | Users read own; admins manage all |
| `templates` | Design templates with fields & preview | Public read; admin CRUD |
| `orders` | Customer orders with status tracking | Customers own; designers see assigned; admins see all |
| `designs` | Uploaded design files per order | Designers upload; customers & designers read |
| `notifications` | Push notifications per user | Users read/update own; admins create |
| `otp_codes` | One-time passwords for phone verification | No RLS (accessed via service role in edge functions) |

### Key Relationships

```
auth.users (1) ←→ (1) profiles         (via user_id)
auth.users (1) ←→ (N) user_roles       (via user_id)
templates  (1) ←→ (N) orders           (via template_id)
orders     (1) ←→ (N) designs          (via order_id)
orders     (1) ←→ (N) notifications    (via order_id)
```

### `profiles` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | References auth.users |
| `display_name` | text | Full name |
| `phone` | text | Phone number |
| `province` | text | محافظة |
| `area` | text | منطقة |
| `landmark` | text | علامة دالة (nearest landmark) |

### `orders` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | UUID | Who placed the order |
| `designer_id` | UUID | Assigned designer (nullable) |
| `template_id` | UUID | FK to templates |
| `status` | enum | See Order Lifecycle below |
| `details` | JSONB | Form field values submitted by customer |
| `customer_name` | text | Denormalized for quick display |
| `customer_phone` | text | Denormalized for quick display |
| `paid_amount` | integer | Amount paid (default 0) |
| `payment_status` | text | 'unpaid' / 'paid' |

### `templates` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | text | Template name |
| `service_type` | enum | business_card, flyer, receipt, letterhead, menu, invitation |
| `preview_url` | text | Image URL for preview |
| `price` | integer | Price per 1000 units |
| `text_fields` | JSONB | Array of field definitions (see Template Field Editor) |
| `description` | text | Template description |

### `text_fields` JSONB Structure
```json
[
  {
    "key": "name",
    "label": "الاسم",
    "placeholder": "أحمد محمد",
    "type": "text",           // "text" or "image"
    "x": 50,                  // X position (% of template width)
    "y": 30,                  // Y position (% of template height)
    "fontSize": 16,           // Font size in px
    "color": "#000000",
    "rotation": 0,            // Degrees (-180 to 180)
    "opacity": 100,           // 0-100
    "width": 30,              // For image type: % of template width
    "height": 20              // For image type: % of template height
  }
]
```

---

## Edge Functions (Backend)

All edge functions are in `supabase/functions/` and deployed automatically.
They use `verify_jwt = false` (public access) as configured in `supabase/config.toml`.

### `phone-login`
- **Purpose**: Create account or sign in using phone number
- **Input**: `{ phone: string, password?: string }`
- **Output**: `{ success: true, session: {...}, isNewUser: boolean }`
- **Logic**: Normalizes phone → synthetic email → try sign in → if fail, create user → return session

### `send-otp`
- **Purpose**: Generate and send OTP via WhatsApp Business API
- **Input**: `{ phone: string }`
- **Requires secrets**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- **Logic**: Generate 6-digit code → save to `otp_codes` → send via WhatsApp template

### `verify-otp`
- **Purpose**: Verify OTP code and create/login user
- **Input**: `{ phone: string, code: string }`
- **Logic**: Check `otp_codes` table → mark used → create/login user → return session

---

## Routing & Pages

### Public Routes (no auth required)
| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Index` | Homepage with popular templates, steps, features |
| `/auth` | `AuthPage` | Phone login |
| `/services` | `ServiceSelection` | Browse all 6 service types |
| `/templates/:serviceType` | `TemplateSelection` | Templates for a service |
| `/template/:templateId` | `TemplateDetails` | Single template view |
| `/cart` | `CartPage` | Shopping cart |

### Authenticated Customer Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/order/:templateId` | `OrderForm` | Fill design details |
| `/complete-profile` | `CompleteProfile` | Mandatory address form (new users) |
| `/checkout` | `CheckoutPage` | Checkout flow |
| `/verify-otp` | `OTPVerification` | Enter OTP code |
| `/order-success` | `OrderSuccess` | Order confirmation |
| `/track-order/:orderId` | `OrderTracking` | Track order status |
| `/my-orders` | `MyOrders` | All customer orders |
| `/profile` | `ProfilePage` | Edit profile |

### Designer Routes (requires `designer` or `admin` role)
| Path | Component | Description |
|------|-----------|-------------|
| `/designer/login` | `DesignerLogin` | Designer login page |
| `/designer/orders` | `DesignerOrders` | Dashboard with tabbed order view |
| `/designer/orders/:orderId` | `DesignerOrderDetails` | Order details + upload design |

### Admin Routes (requires `admin` role)
| Path | Component | Description |
|------|-----------|-------------|
| `/admin` | `AdminPanel` | Full admin dashboard with 6 tabs |

---

## Contexts (Global State)

### `AuthContext` (`src/contexts/AuthContext.tsx`)
Provides:
- `user` — Current Supabase user object
- `session` — Current session
- `role` — `'customer' | 'designer' | 'admin' | null`
- `loading` — Auth loading state
- `phoneLogin(phone, password?)` — Login function
- `signOut()` — Logout → redirect to `/auth`

### `AppContext` (`src/contexts/AppContext.tsx`)
Provides:
- `updateOrderStatus(orderId, status)` — Update order status in DB

### `CartContext` (`src/contexts/CartContext.tsx`)
Provides:
- `items` — Cart items array
- `addItem(item)` — Add/update cart item
- `removeItem(templateId)` — Remove from cart
- `updateQuantity(templateId, qty)` — Change quantity
- `clearCart()` — Empty cart
- `totalPrice` — Computed total
- `itemCount` — Number of items

**Persistence**: Cart is saved to `localStorage` under key `matbaati_cart`.

---

## Design System & Theming

### Color Tokens (HSL in `src/index.css`)

The app uses a **CMYK-inspired** color palette:

| Token | Light Mode | Usage |
|-------|-----------|-------|
| `--primary` | Cyan (190 85% 38%) | Primary brand, buttons, links |
| `--secondary` | Dark (222 47% 11%) | Dark backgrounds, secondary elements |
| `--accent` | Yellow (48 96% 53%) | Highlights, accents |
| `--destructive` | Red (0 84% 60%) | Errors, delete actions |
| `--success` | Green (160 84% 39%) | Success states, submit buttons |
| `--cmyk-magenta` | Magenta (330 80% 50%) | Decorative accent |

### Theme Switching
- Dark mode toggle in header
- Stored in `localStorage` under key `theme`
- Applied via `.dark` class on `<html>`
- All components use semantic tokens (never hardcoded colors)

### Typography
- Font: **Cairo** (Arabic-optimized)
- Set in `index.css` on `html` element
- Heading scales defined in `@layer base`

### Custom Utilities (in `index.css`)
- `.bg-cmyk-*` / `.text-cmyk-*` — CMYK decorative colors
- `.scrollbar-hide` — Hide scrollbars
- `.section-spacing` / `.section-spacing-sm` — Consistent section padding

### Shadow System (in `tailwind.config.ts`)
- `shadow-card` — Subtle card shadow
- `shadow-card-hover` — Elevated card shadow on hover
- `shadow-elevated` — Prominent shadow for CTAs

---

## Key Components

### `Layout.tsx`
- Wraps all pages
- RTL layout (`dir="rtl"`)
- Sticky header with logo, nav links, cart icon, notification bell, dark mode toggle
- Services sub-navbar (circular icons for each service type)
- Mobile hamburger menu with `AnimatePresence`
- CMYK color strip at top and bottom
- Footer with copyright

### `ProtectedRoute.tsx`
```tsx
<ProtectedRoute requiredRole="designer">
  <DesignerOrders />
</ProtectedRoute>
```
- If not authenticated → redirect to `/auth`
- If role doesn't match (and not admin) → redirect to `/`
- Admin can access everything
- Shows spinner while loading

### `DesignCanvasPreview.tsx`
- Renders template image with text fields overlaid at their configured positions
- Used in `OrderForm` for live preview as customer types

### `StatusBadge.tsx`
- Displays order status with color-coded badge
- Uses `STATUS_LABELS` and `STATUS_COLORS` from `mockData.ts`

### `TemplateFieldEditor.tsx` (Admin)
- Visual drag-and-drop field placement editor
- Supports text and image field types
- Controls: position (x, y), font size, color, rotation, opacity
- Image fields have width/height controls
- Used when creating/editing templates in admin panel

---

## Order Lifecycle

```
draft → submitted → assigned → design_uploaded → waiting_approval → approved → print_ready → printed → delivered
```

| Status | Arabic | Who triggers | Description |
|--------|--------|-------------|-------------|
| `draft` | مسودة | System | Initial state (rarely used, orders go straight to submitted) |
| `submitted` | تم الإرسال | Customer | Customer submits order form |
| `assigned` | تم التعيين | Admin | Admin assigns a designer |
| `design_uploaded` | تم رفع التصميم | Designer | Designer uploads first design |
| `waiting_approval` | بانتظار الموافقة | System | Customer needs to review |
| `approved` | تمت الموافقة | Customer | Customer approves design |
| `print_ready` | جاهز للطباعة | Admin | Ready for printing |
| `printed` | تمت الطباعة | Admin | Printing completed |
| `delivered` | تم التسليم | Admin | Delivered to customer |

---

## Role-Based Access Control

### How Roles Work
- Roles are stored in `user_roles` table (not in profiles)
- Checked via `has_role()` PostgreSQL function (SECURITY DEFINER)
- RLS policies use `has_role()` to prevent recursive checks
- Frontend checks via `AuthContext.role`

### Permissions Matrix

| Action | Customer | Designer | Admin |
|--------|----------|----------|-------|
| Browse templates | ✅ | ✅ | ✅ |
| Place orders | ✅ | ❌ | ✅ |
| View own orders | ✅ | ❌ | ✅ |
| View assigned orders | ❌ | ✅ | ✅ |
| Upload designs | ❌ | ✅ | ✅ |
| Change order status | ❌ | ✅ (limited) | ✅ |
| Manage templates | ❌ | ❌ | ✅ |
| Manage users/roles | ❌ | ❌ | ✅ |
| Assign designers | ❌ | ❌ | ✅ |
| Export orders | ❌ | ❌ | ✅ |

---

## Cart System

- **Client-side only** — stored in `localStorage`
- Items contain: `templateId`, `templateName`, `serviceType`, `previewUrl`, `quantity` (in thousands), `unitPrice`
- `totalPrice = sum(unitPrice × quantity)`
- Cart icon in header shows `itemCount` badge
- Cart survives page reloads but not browser data clearing
- Cart is separate from orders (checkout creates orders from cart)

---

## Template Field Editor

The admin can define **text fields** and **image fields** on a template:

### Text Field Properties
- `key` — Unique identifier (e.g., "name", "phone")
- `label` — Arabic label shown to customer
- `placeholder` — Hint text
- `x`, `y` — Position as % of template dimensions
- `fontSize` — 8-72px
- `color` — Hex color
- `rotation` — -180° to 180°
- `opacity` — 0-100%

### Image Field Properties
Same as text plus:
- `width`, `height` — Size as % of template dimensions
- `type: 'image'`

These fields are stored in the `text_fields` JSONB column of the `templates` table.

---

## Notifications

- Stored in `notifications` table
- Only admins can create notifications
- Users see their own via `NotificationBell` component
- Each notification has: `title`, `message`, `order_id` (optional), `read` status
- Bell icon shows unread count badge

---

## Common Patterns

### Supabase Client Usage
```tsx
import { supabase } from '@/integrations/supabase/client';

// Read
const { data, error } = await supabase.from('orders').select('*').eq('customer_id', user.id);

// Insert
const { data, error } = await supabase.from('orders').insert({ ... }).select('id').single();

// Update
const { error } = await supabase.from('orders').update({ status: 'assigned' }).eq('id', orderId);

// Realtime
const channel = supabase.channel('my-channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `designer_id=eq.${userId}` }, callback)
  .subscribe();
```

### Toast Notifications
```tsx
import { useToast } from '@/hooks/use-toast';
const { toast } = useToast();
toast({ title: 'نجاح!', description: 'تمت العملية', variant: 'default' });
toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
```

### Animations
```tsx
import { motion } from 'framer-motion';
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
```

### Service Type Constants
```tsx
import { SERVICES, SERVICE_LABELS, ServiceType } from '@/data/mockData';
// SERVICE_LABELS['business_card'] → 'كروت شخصية'
```

---

## Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | Auto-generated | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Auto-generated | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Auto-generated | Project ID |
| `WHATSAPP_ACCESS_TOKEN` | Secret (edge fn) | WhatsApp Business API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Secret (edge fn) | WhatsApp sender phone ID |
| `SUPABASE_URL` | Auto (edge fn) | Available in edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto (edge fn) | Admin access in edge functions |

⚠️ **Never edit `.env` manually** — it's auto-generated by Lovable Cloud.

---

## Development Guide

### Local Setup
```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

### Adding a New Service Type
1. Add to `service_type` enum via database migration
2. Add entry in `SERVICES` array in `src/data/mockData.ts`
3. Add label in `SERVICE_LABELS`
4. Add icon mapping in `Layout.tsx` → `SERVICE_ICONS`
5. Add color mapping in `TEMPLATE_COLORS`
6. Add aspect ratio in `TEMPLATE_ASPECT_RATIOS`

### Adding a New Order Status
1. Add to `order_status` enum via database migration
2. Add label in `STATUS_LABELS` in `mockData.ts`
3. Add color in `STATUS_COLORS`
4. Update `DesignerOrders.tsx` tabs if needed
5. Update `AdminPanel.tsx` stats calculations

### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Wrap with `<ProtectedRoute>` if auth required
4. Add nav link in `Layout.tsx` → `NAV_ITEMS` if needed

### Adding a New Database Table
1. Use Lovable's migration tool (SQL)
2. Always enable RLS
3. Create appropriate policies using `has_role()` for admin checks
4. Types auto-update in `src/integrations/supabase/types.ts`

### Files You Should NEVER Edit
- `src/integrations/supabase/client.ts` (auto-generated)
- `src/integrations/supabase/types.ts` (auto-generated)
- `.env` (auto-generated)
- `supabase/config.toml` (auto-generated)
- `package.json` (use Lovable tools)

---

## Performance & SEO Optimizations

The following optimizations were applied to improve Lighthouse scores (Performance, Accessibility, SEO):

### Code Splitting & Lazy Loading
- **All route pages** are lazy-loaded via `React.lazy()` + `Suspense`, including the `Index` homepage
- This significantly reduces the initial JS bundle size and unused JavaScript

### Network & Resource Hints
- `preconnect` and `dns-prefetch` hints for Lovable Cloud (Supabase) endpoint
- `preconnect` for Google Fonts (`fonts.googleapis.com` and `fonts.gstatic.com`)

### Font Loading Optimization
- Google Fonts (Cairo) loaded asynchronously using `<link rel="preload" as="style">` with `onload` fallback
- `<noscript>` fallback ensures fonts load when JS is disabled
- Eliminates render-blocking CSS for font stylesheets

### Accessibility (WCAG 2.0 AA)
- **Color contrast**: `--muted-foreground` lightness adjusted from 47% to 44% to meet 4.5:1 contrast ratio requirement
- **Heading hierarchy**: Non-sequential `<h4>` elements replaced with `<p>` tags (same styling) to maintain proper heading order
- **Link accessibility**: All icon-only links (e.g., cart icon) have `aria-label` attributes for screen readers

### SEO Meta Tags
- Open Graph and Twitter Card meta tags for social sharing
- Proper `<title>` and `<meta description>`
- `robots.txt` configured

### Lighthouse Scores (Mobile)
| Category | Score |
|----------|-------|
| Performance | 79 |
| Accessibility | 90 |
| Best Practices | 100 |
| SEO | 100 |

---

## Enums Reference

### `service_type`
`business_card` | `flyer` | `receipt` | `letterhead` | `menu` | `invitation`

### `order_status`
`draft` | `submitted` | `assigned` | `design_uploaded` | `waiting_approval` | `approved` | `print_ready` | `printed` | `delivered`

### `app_role`
`customer` | `designer` | `admin`
