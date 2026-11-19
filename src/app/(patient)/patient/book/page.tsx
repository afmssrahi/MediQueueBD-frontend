"use client";

import { BookAppointmentRoute } from "./book-page";

/**
 * The booking route.
 *
 * The screen itself lives in `book-page.tsx` so it can be wrapped in the
 * Suspense boundary that `useSearchParams` requires.
 */
export default function BookAppointmentPage() {
  return <BookAppointmentRoute />;
}
