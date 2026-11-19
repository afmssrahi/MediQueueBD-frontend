import { beforeEach, describe, expect, it } from "vitest";
import { mockTransport } from "@/api/mock-handlers";
import { resetDb } from "@/demo/db";
import type { DiagnosticCenter, Doctor, Hospital } from "@/types";

/**
 * The public directory tests.
 *
 * The directory screens filter on the server through the service layer, so
 * these tests cover the filters the public pages rely on.
 */
async function call<T>(
  method: string,
  path: string,
  query: Record<string, string> = {},
  body?: unknown,
): Promise<T> {
  const response = await mockTransport.request<T>({
    method,
    path,
    query,
    body,
    userId: null,
  });

  if (!response.success) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }

  return response.data;
}

describe("the public directories", () => {
  beforeEach(() => {
    resetDb();
  });

  it("returns every seeded hospital", async () => {
    const hospitals = await call<Hospital[]>("GET", "/hospitals");
    expect(hospitals.length).toBeGreaterThan(0);
  });

  it("filters the hospitals by division", async () => {
    const all = await call<Hospital[]>("GET", "/hospitals");
    const division = all[0].division;

    const filtered = await call<Hospital[]>("GET", "/hospitals", { division });

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((item) => item.division === division)).toBe(true);
    expect(filtered.length).toBeLessThanOrEqual(all.length);
  });

  it("filters the hospitals by type", async () => {
    const filtered = await call<Hospital[]>("GET", "/hospitals", {
      type: "General",
    });

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((item) => item.type === "General")).toBe(true);
  });

  it("searches the hospitals by name", async () => {
    const all = await call<Hospital[]>("GET", "/hospitals");
    const name = all[0].name;
    const needle = name.split(" ").slice(1, 3).join(" ");

    const filtered = await call<Hospital[]>("GET", "/hospitals", {
      search: needle,
    });

    expect(filtered.length).toBeGreaterThan(0);
  });

  it("returns a hospital with its departments and doctors", async () => {
    const hospitals = await call<Hospital[]>("GET", "/hospitals");
    const hospitalId = hospitals[0].id;

    const detail = await call<{
      hospital: Hospital;
      departments: { id: string }[];
      doctors: Doctor[];
    }>("GET", `/hospitals/${hospitalId}`);

    expect(detail.hospital.id).toBe(hospitalId);
    expect(detail.departments.length).toBeGreaterThan(0);
  });

  it("returns a 404 for a hospital that does not exist", async () => {
    const response = await mockTransport.request<Hospital>({
      method: "GET",
      path: "/hospitals/NOPE",
      userId: null,
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.status).toBe(404);
    }
  });

  it("filters the doctors by speciality", async () => {
    const all = await call<Doctor[]>("GET", "/doctors");
    const speciality = all[0].speciality;

    const filtered = await call<Doctor[]>("GET", "/doctors", { speciality });

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((item) => item.speciality === speciality)).toBe(true);
  });

  it("filters the doctors by hospital", async () => {
    const hospitals = await call<Hospital[]>("GET", "/hospitals");
    const hospitalId = hospitals[0].id;

    const filtered = await call<Doctor[]>("GET", "/doctors", { hospitalId });

    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((item) => item.hospitalIds.includes(hospitalId)),
    ).toBe(true);
  });

  it("returns a doctor with their hospitals and departments", async () => {
    const doctors = await call<Doctor[]>("GET", "/doctors");
    const doctorId = doctors[0].id;

    const detail = await call<{
      doctor: Doctor;
      hospitals: Hospital[];
      departments: { id: string }[];
    }>("GET", `/doctors/${doctorId}`);

    expect(detail.doctor.id).toBe(doctorId);
  });

  it("filters the diagnostic centres by service", async () => {
    const all = await call<DiagnosticCenter[]>("GET", "/diagnostic-centers");
    const service = all[0].services[0];

    const filtered = await call<DiagnosticCenter[]>(
      "GET",
      "/diagnostic-centers",
      { service },
    );

    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((item) => item.services.includes(service)),
    ).toBe(true);
  });

  it("registers a hospital and lists it as pending verification", async () => {
    const created = await call<Hospital>(
      "POST",
      "/hospitals",
      {},
      {
        name: "MediQueue Test Clinic",
        division: "Dhaka",
        address: "Test Road 1, Dhaka 1200",
        phone: "+880 1700 000000",
        type: "Clinic",
        bedCount: 20,
        establishedYear: 2024,
      },
    );

    expect(created.verificationStatus).toBe("PENDING");

    const all = await call<Hospital[]>("GET", "/hospitals");
    expect(all.some((item) => item.id === created.id)).toBe(true);
  });

  it("rejects a hospital registration with no name", async () => {
    const response = await mockTransport.request<Hospital>({
      method: "POST",
      path: "/hospitals",
      body: { division: "Dhaka", address: "Somewhere" },
      userId: null,
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("VALIDATION_ERROR");
      expect(response.error.fields?.name).toBeDefined();
    }
  });
});
