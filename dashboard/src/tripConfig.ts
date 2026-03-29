export const TRIP_FILES = [
  {
    file: "trip_1_cross_country.json",
    label: "Cross-Country Long Haul",
    shortLabel: "Cross-country",
  },
  {
    file: "trip_2_urban_dense.json",
    label: "Urban Dense Delivery",
    shortLabel: "Urban",
  },
  {
    file: "trip_3_mountain_cancelled.json",
    label: "Mountain Route (Cancelled)",
    shortLabel: "Mountain",
  },
  {
    file: "trip_4_southern_technical.json",
    label: "Southern Technical Issues",
    shortLabel: "Southern",
  },
  {
    file: "trip_5_regional_logistics.json",
    label: "Regional Logistics",
    shortLabel: "Regional",
  },
] as const;

export type TripFileName = (typeof TRIP_FILES)[number]["file"];
