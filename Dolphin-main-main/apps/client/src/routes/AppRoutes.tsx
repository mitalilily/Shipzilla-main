// AppRoutes.tsx
import { type ComponentType, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from '../components/auth/wrapper/RequireAuth'
import RequireMerchantReady from '../components/auth/wrapper/RequireMerchantReady'
import RequireOnboard from '../components/auth/wrapper/RequireOnboard'
import Layout from '../components/UI/Layout'
import FullScreenLoader from '../components/UI/loader/FullScreenLoader'
import NavigationLoader from '../components/UI/loader/NavigationLoader'
import Login from '../pages/auth/Login'
import Signup from '../pages/auth/Signup'
import ClientPreview from '../pages/preview/ClientPreview'
import { APP_BASE_PATH } from '../utils/basePath'
import { lazyWithRetry } from '../utils/lazyWithRetry'
import AppEntry from './AppEntry'
import GlobalRedirectHandler from './WalletRedirectHandler'

const lazyRoute = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  cacheKey: string,
) => lazyWithRetry(importFunc, cacheKey)

/* ---------- Lazy-loaded components ---------- */
// Onboarding & Dashboard
const UserOnboarding = lazyRoute(() => import('../pages/onboarding/UserOnboarding'), 'user-onboarding')
const Dashboard = lazyRoute(() => import('../pages/dashboard/Dashboard'), 'dashboard')

// Orders
const Orders = lazyRoute(() => import('../pages/orders/Orders'), 'orders')
const B2COrdersList = lazyRoute(() => import('../components/orders/b2c/B2COrdersList'), 'b2c-orders-list')
const B2bOrders = lazyRoute(() => import('../pages/orders/B2bOrders'), 'b2b-orders')
const CreateOrderWrapper = lazyRoute(
  () => import('../components/orders/CreateOrderWrapper'),
  'create-order-wrapper',
)
const OrderTracking = lazyRoute(() => import('../pages/orders/OrderTracking'), 'order-tracking')

// Settings
const Settings = lazyRoute(() => import('../pages/settings/Settings'), 'settings')
const PickupAddresses = lazyRoute(
  () => import('../pages/pickup-addresses/PickupAddresses'),
  'pickup-addresses',
)
const InvoicePreferences = lazyRoute(
  () => import('../components/settings/InvoicePreference'),
  'invoice-preferences',
)
const LabelSettingsPage = lazyRoute(
  () => import('../components/settings/Label/LabelSettings'),
  'label-settings',
)
const UsersManagement = lazyRoute(
  () => import('../pages/users-management/UsersManagement'),
  'users-management',
)
const CourierPriorityPage = lazyRoute(
  () => import('../components/settings/CourierPriority/CourierPriorityPage'),
  'courier-priority',
)

// Billing
const WalletTransactions = lazyRoute(
  () => import('../pages/billings/WalletTransactions'),
  'wallet-transactions',
)
const Invoices = lazyRoute(() => import('../pages/billings/Invoices'), 'invoices')

// Channels
const Channels = lazyRoute(() => import('../pages/channels/Channels'), 'channels')
const ChannelList = lazyRoute(() => import('../pages/channels/ChannelList'), 'channel-list')

// Policies
const PoliciesLayout = lazyRoute(() => import('../pages/policy/PoliciesLayout'), 'policies-layout')
const AboutUs = lazyRoute(() => import('../pages/policy/AboutUs'), 'about-us')
const CancellationPolicy = lazyRoute(
  () => import('../pages/policy/CancellationPolicy'),
  'cancellation-policy',
)
const CompanyDetails = lazyRoute(() => import('../pages/policy/CompanyDetails'), 'company-details')
const PrivacyPolicy = lazyRoute(() => import('../pages/policy/PrivacyPolicy'), 'privacy-policy')
const TermsOfService = lazyRoute(() => import('../pages/policy/TermsOfService'), 'terms-of-service')

// Profile
const ProfileLayout = lazyRoute(() => import('../pages/profile/Profile'), 'profile-layout')
const UserProfileSettings = lazyRoute(
  () => import('../components/user/UserProfileSettings'),
  'user-profile-settings',
)
const CompanyInfoForm = lazyRoute(
  () => import('../components/user/profile/CompanyInfoForm'),
  'company-info-form',
)
const BankAccountsSection = lazyRoute(() =>
  import('../components/user/profile/bankAccounts/BankAccountsSection').then((m) => ({
    default: m.BankAccountsSection,
  })),
  'bank-accounts-section',
)
const KycSection = lazyRoute(() => import('../components/user/profile/Kyc/KycSection'), 'kyc-section')

// Tools
const RateCard = lazyRoute(() => import('../pages/tools/RateCard'), 'rate-card')
const RateCalculator = lazyRoute(() =>
  import('../pages/tools/RateCalculator').then((m) => ({ default: m.RateCalculator })),
  'rate-calculator',
)
const OrderTrackingForm = lazyRoute(
  () => import('../pages/tools/OrderTrackingForm'),
  'order-tracking-form',
)

// Support
const SupportTicketsPage = lazyRoute(() =>
  import('../pages/support/SupportTicketsPage').then((m) => ({ default: m.SupportTicketsPage })),
  'support-tickets',
)
const TicketDetailsPage = lazyRoute(
  () => import('../pages/support/TicketDetailsPage').then((m) => ({ default: m.TicketDetailsPage })),
  'ticket-details',
)

// Other
const Home = lazyRoute(() => import('../pages/home/Home'), 'home')
const Couriers = lazyRoute(() => import('../pages/couriers/Couriers'), 'couriers')
const CodRemittancesList = lazyRoute(
  () => import('../pages/cod-remittance/CodRemittancesList'),
  'cod-remittances',
)
const KeyboardShortcutsPage = lazyRoute(
  () => import('../pages/KeyboardShortcutsPage'),
  'keyboard-shortcuts',
)
const Reports = lazyRoute(() => import('../pages/reports/Reports'), 'reports')

// Weight Reconciliation
const WeightReconciliation = lazyRoute(
  () => import('../pages/weight-reconciliation/WeightReconciliation'),
  'weight-reconciliation',
)
const DiscrepancyDetails = lazyRoute(
  () => import('../pages/weight-reconciliation/DiscrepancyDetails'),
  'discrepancy-details',
)
const WeightReconciliationSettings = lazyRoute(
  () => import('../pages/weight-reconciliation/WeightReconciliationSettings'),
  'weight-reconciliation-settings',
)
// Ops (NDR/RTO)
const NdrList = lazyRoute(() => import('../pages/ops/NdrList'), 'ndr-list')
const RtoList = lazyRoute(() => import('../pages/ops/RtoList'), 'rto-list')
// API Integration
const ApiIntegration = lazyRoute(
  () => import('../pages/settings/ApiIntegration'),
  'api-integration',
)

export default function AppRoutes() {
  return (
    <BrowserRouter basename={APP_BASE_PATH || undefined}>
      <NavigationLoader />
      <GlobalRedirectHandler />
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          {/* public */}
          <Route path="/" element={<AppEntry />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/app" element={<AppEntry />} />
          <Route path="/preview" element={<ClientPreview />} />
          <Route path="/tracking" element={<OrderTracking />} /> {/* 👈 NEW ROUTE */}
          {/* onboarding */}
          <Route
            path="/onboarding-questions"
            element={
              <RequireOnboard>
                <UserOnboarding />
              </RequireOnboard>
            }
          />
          {/* private layout (requires auth) */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/manage_pickups" element={<PickupAddresses />} />
            <Route path="/billing/wallet_transactions" element={<WalletTransactions />} />
            <Route path="/billing/invoice_management" element={<Invoices />} />
            <Route path="/orders/list" element={<Orders />} />
            <Route
              path="/orders/create"
              element={
                <RequireMerchantReady>
                  <CreateOrderWrapper />
                </RequireMerchantReady>
              }
            />
            <Route path="/orders/b2c/list" element={<B2COrdersList />} />
            <Route path="/support/about_us" element={<AboutUs />} />
            <Route path="/orders/b2b/list" element={<B2bOrders />} />
            <Route path="/settings/invoice_preferences" element={<InvoicePreferences />} />
            <Route path="/settings/label_config" element={<LabelSettingsPage />} />
            <Route path="/settings/users_management" element={<UsersManagement />} />
            <Route path="/settings/courier_priority" element={<CourierPriorityPage />} />
            <Route path="/settings/api-integration" element={<ApiIntegration />} />
            <Route path="/channels/connected" element={<Channels />} />
            <Route path="/channels/channel_list" element={<ChannelList />} />
            <Route path="/policies/*" element={<PoliciesLayout />}>
              <Route path="refund_cancellation" element={<CancellationPolicy />} />
              <Route path="privacy_policy" element={<PrivacyPolicy />} />
              <Route path="terms_of_service" element={<TermsOfService />} />
              <Route path="contact_us" element={<CompanyDetails />} />
            </Route>
            <Route path="/help/shortcuts" element={<KeyboardShortcutsPage />} />
            <Route path="/profile/*" element={<ProfileLayout />}>
              <Route path="user_profile/*" element={<UserProfileSettings />} />
              <Route index element={<Navigate to="user_profile" replace />} />
              <Route path="user_profile" element={<UserProfileSettings />} />
              <Route path="company" element={<CompanyInfoForm />} />
              <Route path="password" element={<UserProfileSettings />} />
              <Route path="bank_details" element={<BankAccountsSection />} />
              <Route path="kyc_details" element={<KycSection />} />
            </Route>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tools/rate_card" element={<RateCard />} />
            <Route path="/tools/rate_calculator" element={<RateCalculator />} />
            <Route path="/tools/order_tracking" element={<OrderTrackingForm />} />
            <Route path="/support/tickets" element={<SupportTicketsPage />} />
            <Route path="/support/tickets/:id" element={<TicketDetailsPage />} />
            <Route path="/home" element={<Home />} />
            <Route path="/couriers/partners" element={<Couriers />} />
            <Route path="/cod-remittance" element={<CodRemittancesList />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reconciliation/weight" element={<WeightReconciliation />} />
            <Route path="/reconciliation/weight/:id" element={<DiscrepancyDetails />} />
            <Route
              path="/reconciliation/weight/settings"
              element={<WeightReconciliationSettings />}
            />
            {/* Ops */}
            <Route path="/ops/ndr" element={<NdrList />} />
            <Route path="/ops/rto" element={<RtoList />} />
          </Route>
          {/* fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
