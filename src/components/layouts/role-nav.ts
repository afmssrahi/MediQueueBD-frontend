import type { Role } from "@/types";
import {
  Activity,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
  MapPin,
  MessageSquareWarning,
  Settings,
  Sparkles,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The role-aware navigation.
 *
 * Each role gets its own items. The `permission` on an item is checked by the
 * sidebar before it renders, so the nav and the RBAC map stay in step.
 */

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  permission?: string;
  /** Only show this item when the item above it is active (nested routes). */
  matchPrefix?: boolean;
}

export interface NavSection {
  titleKey: string;
  items: NavItem[];
}

export const ROLE_NAV: Record<Role, NavSection[]> = {
  PATIENT: [
    {
      titleKey: "nav.dashboard",
      items: [
        { href: "/patient", labelKey: "nav.dashboard", icon: LayoutDashboard, matchPrefix: false },
        { href: "/patient/appointments", labelKey: "nav.myAppointments", icon: CalendarDays },
        { href: "/patient/book", labelKey: "nav.bookAppointment", icon: CalendarDays },
        { href: "/patient/queue", labelKey: "nav.waitingTime", icon: Activity },
        { href: "/patient/records", labelKey: "nav.medicalRecords", icon: FileText },
        { href: "/patient/reports", labelKey: "nav.diagnosticReports", icon: ClipboardList },
        { href: "/patient/summary", labelKey: "nav.aiSummary", icon: Sparkles },
        { href: "/patient/profile", labelKey: "nav.profile", icon: Settings },
      ],
    },
    {
      titleKey: "nav.findDoctors",
      items: [
        { href: "/hospitals", labelKey: "nav.hospitals", icon: Building2 },
        { href: "/doctors", labelKey: "nav.doctors", icon: Stethoscope },
        { href: "/diagnostic-centers", labelKey: "nav.diagnosticCenters", icon: HeartPulse },
      ],
    },
  ],

  DOCTOR: [
    {
      titleKey: "nav.dashboard",
      items: [
        { href: "/doctor", labelKey: "nav.dashboard", icon: LayoutDashboard, matchPrefix: false },
        { href: "/doctor/queue", labelKey: "nav.queueBoard", icon: Activity },
        { href: "/doctor/appointments", labelKey: "nav.appointments", icon: CalendarDays },
        { href: "/doctor/patients", labelKey: "nav.patientRecords", icon: FileText },
        { href: "/doctor/summary", labelKey: "nav.aiSummary", icon: Sparkles },
      ],
    },
  ],

  HOSPITAL_STAFF: [
    {
      titleKey: "nav.dashboard",
      items: [
        { href: "/hospital", labelKey: "nav.dashboard", icon: LayoutDashboard, matchPrefix: false },
        { href: "/hospital/queue", labelKey: "nav.queueBoard", icon: Activity },
        { href: "/hospital/appointments", labelKey: "nav.appointments", icon: CalendarDays },
        { href: "/hospital/patients", labelKey: "nav.patientRecords", icon: FileText },
      ],
    },
  ],

  HOSPITAL_ADMIN: [
    {
      titleKey: "nav.dashboard",
      items: [
        { href: "/hospital/admin", labelKey: "nav.dashboard", icon: LayoutDashboard, matchPrefix: false },
        { href: "/hospital/admin/doctors", labelKey: "nav.manageDoctors", icon: Stethoscope },
        { href: "/hospital/admin/departments", labelKey: "nav.departments", icon: Building2 },
        { href: "/hospital/admin/staff", labelKey: "nav.manageStaff", icon: Users },
        { href: "/hospital/admin/appointments", labelKey: "nav.appointments", icon: CalendarDays },
        { href: "/hospital/admin/queue", labelKey: "nav.queueOverview", icon: Activity },
        { href: "/hospital/admin/analytics", labelKey: "nav.analytics", icon: LayoutDashboard },
      ],
    },
  ],

  DIAGNOSTIC_STAFF: [
    {
      titleKey: "nav.dashboard",
      items: [
        { href: "/diagnostic", labelKey: "nav.dashboard", icon: LayoutDashboard, matchPrefix: false },
        { href: "/diagnostic/reports", labelKey: "nav.reportQueue", icon: ClipboardList },
        { href: "/diagnostic/patients", labelKey: "nav.patientRecords", icon: Users },
      ],
    },
  ],

  SYSTEM_ADMIN: [
    {
      titleKey: "nav.dashboard",
      items: [
        { href: "/admin", labelKey: "nav.dashboard", icon: LayoutDashboard, matchPrefix: false },
        { href: "/admin/users", labelKey: "nav.users", icon: Users },
        { href: "/admin/hospitals", labelKey: "nav.hospitals", icon: Building2 },
        { href: "/admin/diagnostics", labelKey: "nav.diagnosticCenters", icon: HeartPulse },
        { href: "/admin/analytics", labelKey: "nav.analytics", icon: LayoutDashboard },
        { href: "/admin/scenarios", labelKey: "nav.scenarios", icon: MessageSquareWarning },
        { href: "/admin/settings", labelKey: "nav.systemSettings", icon: Settings },
      ],
    },
  ],
};

/** The public directory navigation, shown to everyone. */
export const PUBLIC_NAV: NavItem[] = [
  { href: "/hospitals", labelKey: "nav.hospitals", icon: Building2 },
  { href: "/doctors", labelKey: "nav.doctors", icon: Stethoscope },
  { href: "/diagnostic-centers", labelKey: "nav.diagnosticCenters", icon: HeartPulse },
  { href: "/maps", labelKey: "nav.maps", icon: MapPin },
];
