import { fail, ok } from "@/api/envelope";
import { readDb, writeDb } from "@/demo/db";
import type { Department, Doctor, Hospital } from "@/types";
import { bodyOf, queryOf, type HandlerMap } from "../mock-transport";

export const hospitalHandlers: HandlerMap = {
  "GET /hospitals": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let hospitals = db.hospitals;

    if (query.division) {
      hospitals = hospitals.filter((item) => item.division === query.division);
    }
    if (query.type) {
      hospitals = hospitals.filter((item) => item.type === query.type);
    }
    if (query.speciality) {
      const doctorIds = new Set(
        db.doctors
          .filter((doctor) => doctor.speciality === query.speciality)
          .map((doctor) => doctor.id),
      );
      hospitals = hospitals.filter((hospital) =>
        doctorIds.has(
          db.departments.find(
            (department) =>
              department.hospitalId === hospital.id &&
              doctorIds.has(department.headDoctorId ?? ""),
          )?.headDoctorId ?? "",
        ),
      );
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      hospitals = hospitals.filter((item) =>
        `${item.name} ${item.address} ${item.division} ${item.type}`
          .toLowerCase()
          .includes(needle),
      );
    }

    const sort = query.sort ?? "name";
    hospitals = [...hospitals].sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "beds") return b.bedCount - a.bedCount;
      if (sort === "established")
        return a.establishedYear - b.establishedYear;
      return a.name.localeCompare(b.name);
    });

    return ok(hospitals, {
      total: hospitals.length,
      page: 1,
      pageSize: hospitals.length,
      totalPages: 1,
    });
  },

  "GET /hospitals/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const hospital = db.hospitals.find((item) => item.id === query.id);

    if (!hospital) {
      return fail("NOT_FOUND", "No such hospital.", 404);
    }

    const departments = db.departments.filter(
      (item) => item.hospitalId === hospital.id,
    );
    const doctors = db.doctors.filter(
      (doctor) => doctor.hospitalIds.includes(hospital.id),
    );

    return ok({ hospital, departments, doctors });
  },

  "POST /hospitals": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const name = String(body.name ?? "").trim();
    const address = String(body.address ?? "").trim();
    const division = String(body.division ?? "").trim();

    const fields: Record<string, string> = {};
    if (!name) fields.name = "Name is required";
    if (!address) fields.address = "Address is required";
    if (!division) fields.division = "Division is required";
    if (fields.name || fields.address || fields.division) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, fields);
    }

    const created: Hospital = {
      id: `H${String(db.counters.hospital + 1).padStart(3, "0")}`,
      name,
      division,
      address,
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      type: (body.type as Hospital["type"]) ?? "General",
      bedCount: Number(body.bedCount ?? 0),
      establishedYear: Number(body.establishedYear ?? new Date().getFullYear()),
      rating: 0,
      coordinates: {
        latitude: Number(body.latitude ?? 23.81),
        longitude: Number(body.longitude ?? 90.41),
      },
      facilities: Array.isArray(body.facilities)
        ? (body.facilities as string[])
        : [],
      description: String(body.description ?? ""),
      registrationNumber: String(body.registrationNumber ?? ""),
      verificationStatus: "PENDING",
      imageUrl: null,
    };

    writeDb((current) => ({
      ...current,
      hospitals: [...current.hospitals, created],
      counters: { ...current.counters, hospital: current.counters.hospital + 1 },
    }));

    return ok(created);
  },
};

export const departmentHandlers: HandlerMap = {
  "GET /departments": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let departments = db.departments;
    if (query.hospitalId) {
      departments = departments.filter(
        (item) => item.hospitalId === query.hospitalId,
      );
    }

    return ok(departments, {
      total: departments.length,
      page: 1,
      pageSize: departments.length,
      totalPages: 1,
    });
  },

  "GET /departments/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const department = db.departments.find((item) => item.id === query.id);

    if (!department) {
      return fail("NOT_FOUND", "No such department.", 404);
    }

    const doctors = db.doctors.filter((doctor) =>
      doctor.departmentIds.includes(department.id),
    );

    return ok({ department, doctors });
  },

  "POST /departments": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const name = String(body.name ?? "").trim();
    const hospitalId = String(body.hospitalId ?? "");

    if (!name) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, {
        name: "Name is required",
      });
    }
    if (!hospitalId || !db.hospitals.some((item) => item.id === hospitalId)) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, {
        hospitalId: "Choose a valid hospital",
      });
    }

    const created: Department = {
      id: `DEP${String(db.counters.department + 1).padStart(3, "0")}`,
      hospitalId,
      name,
      floor: String(body.floor ?? "Ground Floor"),
      headDoctorId: (body.headDoctorId as string) ?? null,
      roomCount: Number(body.roomCount ?? 1),
    };

    writeDb((current) => ({
      ...current,
      departments: [...current.departments, created],
      counters: {
        ...current.counters,
        department: current.counters.department + 1,
      },
    }));

    return ok(created);
  },

  "PATCH /departments/:id": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const department = db.departments.find((item) => item.id === query.id);

    if (!department) {
      return fail("NOT_FOUND", "No such department.", 404);
    }

    const updated: Department = {
      ...department,
      name: body.name !== undefined ? String(body.name) : department.name,
      floor: body.floor !== undefined ? String(body.floor) : department.floor,
      headDoctorId:
        body.headDoctorId !== undefined
          ? ((body.headDoctorId as string) ?? null)
          : department.headDoctorId,
      roomCount:
        body.roomCount !== undefined
          ? Number(body.roomCount)
          : department.roomCount,
    };

    writeDb((current) => ({
      ...current,
      departments: current.departments.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));

    return ok(updated);
  },

  "DELETE /departments/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const department = db.departments.find((item) => item.id === query.id);

    if (!department) {
      return fail("NOT_FOUND", "No such department.", 404);
    }

    writeDb((current) => ({
      ...current,
      departments: current.departments.filter((item) => item.id !== query.id),
      doctors: current.doctors.map((doctor) => ({
        ...doctor,
        departmentIds: doctor.departmentIds.filter(
          (id) => id !== department.id,
        ),
      })),
    }));

    return ok({ success: true });
  },
};

export const doctorHandlers: HandlerMap = {
  "GET /doctors": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let doctors = db.doctors;

    if (query.speciality) {
      doctors = doctors.filter((item) => item.speciality === query.speciality);
    }
    if (query.hospitalId) {
      doctors = doctors.filter((item) =>
        item.hospitalIds.includes(query.hospitalId),
      );
    }
    if (query.departmentId) {
      doctors = doctors.filter((item) =>
        item.departmentIds.includes(query.departmentId),
      );
    }
    if (query.active !== undefined && query.active !== "") {
      const active = query.active === "true";
      doctors = doctors.filter((item) => item.active === active);
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      doctors = doctors.filter((item) =>
        `${item.name} ${item.speciality} ${item.qualification}`
          .toLowerCase()
          .includes(needle),
      );
    }

    const sort = query.sort ?? "name";
    doctors = [...doctors].sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "experience") return b.experienceYears - a.experienceYears;
      if (sort === "fee") return a.consultationFee - b.consultationFee;
      return a.name.localeCompare(b.name);
    });

    return ok(doctors, {
      total: doctors.length,
      page: 1,
      pageSize: doctors.length,
      totalPages: 1,
    });
  },

  "GET /doctors/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const doctor = db.doctors.find((item) => item.id === query.id);

    if (!doctor) {
      return fail("NOT_FOUND", "No such doctor.", 404);
    }

    const hospitals = db.hospitals.filter((item) =>
      doctor.hospitalIds.includes(item.id),
    );
    const departments = db.departments.filter((item) =>
      doctor.departmentIds.includes(item.id),
    );

    return ok({ doctor, hospitals, departments });
  },

  "POST /doctors": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const name = String(body.name ?? "").trim();
    const speciality = String(body.speciality ?? "").trim();

    const fields: Record<string, string> = {};
    if (!name) fields.name = "Name is required";
    if (!speciality) fields.speciality = "Speciality is required";
    if (fields.name || fields.speciality) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, fields);
    }

    const created: Doctor = {
      id: `D${String(db.counters.doctor + 1).padStart(3, "0")}`,
      name,
      title: String(body.title ?? "Consultant"),
      speciality,
      hospitalIds: Array.isArray(body.hospitalIds)
        ? (body.hospitalIds as string[])
        : [],
      departmentIds: Array.isArray(body.departmentIds)
        ? (body.departmentIds as string[])
        : [],
      qualification: String(body.qualification ?? ""),
      experienceYears: Number(body.experienceYears ?? 0),
      consultationFee: Number(body.consultationFee ?? 500),
      registrationNumber: String(body.registrationNumber ?? ""),
      bkashNumber: String(body.bkashNumber ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      languages: Array.isArray(body.languages)
        ? (body.languages as string[])
        : ["Bangla"],
      bio: String(body.bio ?? ""),
      rating: 0,
      totalPatients: 0,
      imageUrl: null,
      sessionStart: Number(body.sessionStart ?? 9 * 60),
      sessionEnd: Number(body.sessionEnd ?? 17 * 60),
      consultationHistory: [],
      defaultConsultationDuration: Number(
        body.defaultConsultationDuration ?? 12,
      ),
      availableWeekdays: Array.isArray(body.availableWeekdays)
        ? (body.availableWeekdays as number[])
        : [1, 2, 3, 4, 5],
      active: true,
    };

    writeDb((current) => ({
      ...current,
      doctors: [...current.doctors, created],
      counters: { ...current.counters, doctor: current.counters.doctor + 1 },
    }));

    return ok(created);
  },

  "PATCH /doctors/:id": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const doctor = db.doctors.find((item) => item.id === query.id);

    if (!doctor) {
      return fail("NOT_FOUND", "No such doctor.", 404);
    }

    const updated: Doctor = {
      ...doctor,
      name: body.name !== undefined ? String(body.name) : doctor.name,
      speciality:
        body.speciality !== undefined
          ? String(body.speciality)
          : doctor.speciality,
      qualification:
        body.qualification !== undefined
          ? String(body.qualification)
          : doctor.qualification,
      consultationFee:
        body.consultationFee !== undefined
          ? Number(body.consultationFee)
          : doctor.consultationFee,
      experienceYears:
        body.experienceYears !== undefined
          ? Number(body.experienceYears)
          : doctor.experienceYears,
      active:
        body.active !== undefined ? body.active === true : doctor.active,
      sessionStart:
        body.sessionStart !== undefined
          ? Number(body.sessionStart)
          : doctor.sessionStart,
      sessionEnd:
        body.sessionEnd !== undefined
          ? Number(body.sessionEnd)
          : doctor.sessionEnd,
    };

    writeDb((current) => ({
      ...current,
      doctors: current.doctors.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));

    return ok(updated);
  },
};
