import type { AdminHoursRange } from "@/lib/data/admin-shops";

/** One-time directory data gathered from Google Maps, near TREM Ojere. */

export type DirectoryShop = {
  name: string;
  address: string;
  phone: string | null;
  website?: string;
  /** Google Maps `cid` link id — resolved to coordinates by resolve-maps.ts. */
  cid: string;
  /** Rough straight-line km from TREM Ojere, as reported when compiled. */
  expectedKm: number;
  /** "unknown" when Google's hours were unusable (e.g. a broken closing time). */
  hoursSource: "manual" | "unknown";
  /** Sunday-first week; empty array = closed that day. */
  week: AdminHoursRange[][];
};

const closed: AdminHoursRange[] = [];
const daily = (open: string, close: string): AdminHoursRange[][] =>
  Array.from({ length: 7 }, () => [{ open, close }]);
const monSat = (open: string, close: string): AdminHoursRange[][] =>
  Array.from({ length: 7 }, (_, day) =>
    day === 0 ? closed : [{ open, close }],
  );

export const TREM_LINK =
  "https://maps.google.com/?cid=11802208936420184512";

export const MAPOLY_QUERY = "Moshood Abiola Polytechnic, Ojere, Abeokuta";

export const DIRECTORY_SHOPS: DirectoryShop[] = [
  {
    name: "Unique Haircut",
    address: "Sogeke, Abeokuta",
    phone: "0814 833 3530",
    cid: "15148517344584837469",
    expectedKm: 0.7,
    hoursSource: "manual",
    week: monSat("09:00", "19:00"),
  },
  {
    name: "D'bright Barbers",
    address: "Oluwo Street, Onikolobo, Abeokuta",
    phone: "0806 080 9983",
    cid: "15668436956532593222",
    expectedKm: 0.8,
    hoursSource: "unknown",
    week: Array.from({ length: 7 }, () => closed),
  },
  {
    name: "Barberyemmy Salon (Kaybee)",
    address: "Shop 5, Oluwo Street, beside First Golden Grace Nursery and Primary School, Abeokuta",
    phone: "0706 635 3053",
    cid: "10728223962862763627",
    expectedKm: 1.3,
    hoursSource: "manual",
    week: Array.from({ length: 7 }, (_, day) => {
      if (day === 0) return [{ open: "12:00", close: "21:30" }];
      return [{ open: "08:00", close: "21:30" }];
    }),
  },
  {
    name: "HZN Classic Cut",
    address: "5 Oderinde Street, Adigbe Mango, Surulere, Abeokuta",
    phone: "0803 690 3435",
    cid: "325625665118911580",
    expectedKm: 1.4,
    hoursSource: "manual",
    week: Array.from({ length: 7 }, (_, day) => {
      if (day === 0) return [{ open: "12:00", close: "21:00" }];
      return [{ open: "08:00", close: "21:00" }];
    }),
  },
  {
    name: "Awesome Ace Trim and Fades",
    address: "32 Oloke St, opposite Fowotade Guest House, Ibara, Abeokuta",
    phone: "0815 674 5676",
    website: "http://www.facebook.com/AwesomeAceTrimAndFades",
    cid: "14434298582764846953",
    expectedKm: 1.4,
    hoursSource: "manual",
    week: Array.from({ length: 7 }, (_, day) => {
      if (day === 0) return [{ open: "13:00", close: "21:00" }];
      if (day === 4) return [{ open: "10:00", close: "21:00" }];
      return [{ open: "09:00", close: "21:00" }];
    }),
  },
  {
    name: "Silent Cut Unisex Salon",
    address: "Amazing Grace, 36 Oloke St, Ibara, Abeokuta",
    phone: "0703 188 7824",
    cid: "9465296130224243956",
    expectedKm: 1.5,
    hoursSource: "manual",
    week: monSat("09:00", "18:00"),
  },
  {
    name: "Sunshine Barbing Saloon",
    address: "Shop 19 & 20, Ondun Plaza, Mongoro Road, Adigbe, Abeokuta",
    phone: "0906 912 5193",
    cid: "6847326680823113750",
    expectedKm: 1.8,
    hoursSource: "manual",
    week: daily("09:00", "21:00"),
  },
  {
    name: "Interactive Barbers Shop",
    address: "Onikolobo, Abeokuta",
    phone: "0806 0269 1092",
    cid: "16449864130638374329",
    expectedKm: 1.9,
    hoursSource: "manual",
    week: Array.from({ length: 7 }, (_, day) => {
      if (day === 0) return [{ open: "14:00", close: "22:00" }];
      return [{ open: "09:00", close: "22:00" }];
    }),
  },
  {
    name: "OllySmiles Enterprises",
    address: "No. 3 Oluwo Street, Oluwo Rd, Onikolobo, Abeokuta",
    phone: "0906 190 2792",
    website: "https://www.tiktok.com/@ollysmiles1",
    cid: "14150246523557376902",
    expectedKm: 1.9,
    hoursSource: "manual",
    week: Array.from({ length: 7 }, (_, day) => {
      if (day === 0) return [{ open: "13:00", close: "21:00" }];
      if (day === 4) return [{ open: "10:00", close: "21:00" }];
      if (day === 6) return [{ open: "09:00", close: "21:30" }];
      return [{ open: "09:00", close: "21:00" }];
    }),
  },
  {
    name: "Hair by Moore Unisex Salon",
    address: "Adigbe, Abeokuta",
    phone: "0706 153 4708",
    website: "http://hairbymoore.taplink.ws/",
    cid: "1832538726773831782",
    expectedKm: 2.1,
    hoursSource: "manual",
    week: Array.from({ length: 7 }, (_, day) => {
      if (day === 0) return [{ open: "12:00", close: "18:00" }];
      if (day === 4) return [{ open: "10:00", close: "19:00" }];
      if (day === 6) return [{ open: "09:00", close: "20:00" }];
      return [{ open: "09:00", close: "19:00" }];
    }),
  },
  {
    name: "Sirdamx Unisex Barbershop",
    address: "Cleverbiz Plaza, Afobaje Junction, Mango Road, Adigbe, opposite Rikmat Eatery, Abeokuta",
    phone: "0816 653 6235",
    cid: "6098458873281419031",
    expectedKm: 2.2,
    hoursSource: "manual",
    week: monSat("00:00", "23:59"),
  },
  {
    name: "Abdul Barbers Shop",
    address: "5 Panseke, Abeokuta",
    phone: "0703 022 8127",
    cid: "2637721050680587986",
    expectedKm: 2.3,
    hoursSource: "manual",
    week: monSat("09:00", "18:00"),
  },
  {
    name: "Kapick Exclusive Cutz",
    address: "Panseke, Abeokuta",
    phone: "0813 764 6664",
    cid: "14267624017490318189",
    expectedKm: 2.4,
    hoursSource: "manual",
    week: daily("09:12", "21:12"),
  },
  {
    name: "Olax Barbing Saloon",
    address: "Panseke, Abeokuta",
    phone: "0816 632 8092",
    cid: "5386614939214637151",
    expectedKm: 2.4,
    hoursSource: "manual",
    week: daily("08:00", "21:00"),
  },
  {
    name: "Drey Swizzy Barbing Salon",
    address: "26 Mercy Rd, Safari, Abeokuta",
    phone: "0803 273 4400",
    cid: "10081896723764030930",
    expectedKm: 2.5,
    hoursSource: "manual",
    week: monSat("09:00", "18:00"),
  },
  {
    name: "Manspace Barbershop & Café",
    address: "101 Obafemi Awolowo Rd, beside Nigerian Postal Service, Panseke, Abeokuta",
    phone: "0813 492 5731",
    website: "https://manspacelifestyle.dimpified.com/",
    cid: "13507101722559734257",
    expectedKm: 2.9,
    hoursSource: "manual",
    week: Array.from({ length: 7 }, (_, day) => {
      if (day === 0) return closed;
      if (day === 4) return [{ open: "10:00", close: "20:45" }];
      return [{ open: "09:00", close: "20:45" }];
    }),
  },
];
