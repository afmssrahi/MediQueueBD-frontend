"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, HeartPulse, MapPin } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useHospitals } from "@/features/hospitals/hooks/use-hospitals";
import { useCenters } from "@/features/diagnostics/hooks/use-diagnostics";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MapPlaceholder } from "@/components/shared/map-placeholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  estimatedTravelMinutes,
  formatDistance,
  roadDistanceKm,
} from "@/lib/geo";
import { DIVISIONS } from "@/lib/constants";

type FacilityKind = "hospital" | "center";

interface Facility {
  id: string;
  name: string;
  kind: FacilityKind;
  href: string;
  coordinates: { latitude: number; longitude: number };
  address: string;
}

/**
 * The location screen.
 *
 * There is no map provider in the prototype, so the panel is a static preview
 * with the seeded coordinates and the nearby list is calculated from them. The
 * distances are approximate and the screen says so.
 */
export default function MapsPage() {
  const { t } = useTranslation();
  const [division, setDivision] = React.useState("");
  const [kind, setKind] = React.useState<FacilityKind | "all">("all");
  const [selectedId, setSelectedId] = React.useState<string>("");

  const hospitals = useHospitals(division ? { division } : {});
  const centers = useCenters(division ? { division } : {});

  const facilities: Facility[] = [
    ...(hospitals.data ?? []).map((hospital) => ({
      id: hospital.id,
      name: hospital.name,
      kind: "hospital" as const,
      href: `/hospitals/${hospital.id}`,
      coordinates: hospital.coordinates,
      address: hospital.address,
    })),
    ...(centers.data ?? []).map((center) => ({
      id: center.id,
      name: center.name,
      kind: "center" as const,
      href: `/diagnostic-centers/${center.id}`,
      coordinates: center.coordinates,
      address: center.address,
    })),
  ];

  const visibleFacilities = facilities.filter(
    (facility) => kind === "all" || facility.kind === kind,
  );

  const selected =
    visibleFacilities.find((facility) => facility.id === selectedId) ??
    visibleFacilities[0];

  // The nearby list is measured from the selected facility.
  const nearby = selected
    ? visibleFacilities
        .filter((facility) => facility.id !== selected.id)
        .map((facility) => ({
          ...facility,
          distanceKm: roadDistanceKm(selected.coordinates, facility.coordinates),
          travelMinutes: estimatedTravelMinutes(
            selected.coordinates,
            facility.coordinates,
          ),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
    : [];

  const nearbyHospitals = nearby.filter((facility) => facility.kind === "hospital");
  const nearbyCentres = nearby.filter((facility) => facility.kind === "center");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("maps.title")}
        description={t("maps.subtitle")}
        actions={<DemoBadge />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {selected ? (
            <>
              <MapPlaceholder
                coordinates={selected.coordinates}
                label={selected.name}
                markers={nearby.map((facility) => ({
                  coordinates: facility.coordinates,
                  label: facility.name,
                }))}
                height={320}
              />

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">
                    {t("maps.selectFacility")}
                  </CardTitle>
                  <Select
                    value={selected.id}
                    onValueChange={setSelectedId}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder={t("maps.selectFacility")} />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleFacilities.map((facility) => (
                        <SelectItem key={facility.id} value={facility.id}>
                          {facility.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{selected.name}</p>
                  <p className="text-muted-foreground">{selected.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("maps.coordinates")}:{" "}
                    {selected.coordinates.latitude.toFixed(4)},{" "}
                    {selected.coordinates.longitude.toFixed(4)}
                  </p>
                </CardContent>
              </Card>

              {nearbyHospitals.length > 0 && (
                <NearbyCard
                  title={t("maps.nearbyHospitals")}
                  facilities={nearbyHospitals}
                />
              )}

              {nearbyCentres.length > 0 && (
                <NearbyCard
                  title={t("maps.nearbyCentres")}
                  facilities={nearbyCentres}
                />
              )}
            </>
          ) : (
            <EmptyState
              title={t("common.emptyState.title")}
              description={t("common.emptyState.description")}
              icon={MapPin}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("common.filter")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={division}
                onValueChange={(value) => {
                  setDivision(value === "all" ? "" : value);
                  setSelectedId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("hospitals.allDivisions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("hospitals.allDivisions")}</SelectItem>
                  {DIVISIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={kind}
                onValueChange={(value) => {
                  setKind(value as FacilityKind | "all");
                  setSelectedId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("common.all")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="hospital">
                    {t("publicPortal.browseHospitals")}
                  </SelectItem>
                  <SelectItem value="center">
                    {t("publicPortal.browseCenters")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("maps.mapPlaceholder")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t("maps.mapPlaceholderHint")}</p>
              <p>{t("maps.directionsUnavailable")}</p>
              <p>{t("maps.distanceSimulatedHint")}</p>
              <p className="text-xs">{t("common.demoDataNotice")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** One nearby list — hospitals or diagnostic centres. */
function NearbyCard({
  title,
  facilities,
}: {
  title: string;
  facilities: (Facility & {
    distanceKm: number;
    travelMinutes: number;
  })[];
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {facilities.map((facility) => (
            <li
              key={facility.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {facility.kind === "hospital" ? (
                    <Building2 className="size-4" />
                  ) : (
                    <HeartPulse className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <Link
                    href={facility.href}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {facility.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {facility.address}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {formatDistance(facility.distanceKm)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ≈{facility.travelMinutes} {t("common.minutes")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
