import { ItemId } from '../types';

export type IconKey =
  | ItemId
  | 'water'
  | 'heart'
  | 'sparkle'
  | 'basket'
  | 'crate'
  | 'coin'
  | 'sun'
  | 'moon'
  | 'sunset'
  | 'door'
  | 'hammer';

export const ITEM_ICONS: Record<IconKey, string> = {
  hoe: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 37L31 18" stroke="#A66B3F" stroke-width="5" stroke-linecap="round"/>
    <path d="M12 37L31 18" stroke="#C88B59" stroke-width="2" stroke-linecap="round"/>
    <path d="M27 14L37 24C39 22 39.5 18 37.5 15L32 9.5C30 11 28.5 12.5 27 14Z" fill="#8C99A6" stroke="#53606D" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M31.5 13L35.5 17" stroke="#DCE6EF" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  watering_can: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 24C8 24 7 18 11 16C14 14.5 17 16 17 20" stroke="#4D8EB8" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M31 27L40 19" stroke="#6AB9E8" stroke-width="4.2" stroke-linecap="round"/>
    <ellipse cx="41" cy="18" rx="2.6" ry="4" transform="rotate(-38 41 18)" fill="#E7C26B" stroke="#8C6B2F" stroke-width="1.6"/>
    <rect x="14" y="19" width="18" height="17" rx="5" fill="#77C4F0" stroke="#437DA3" stroke-width="2.2"/>
    <path d="M17 23H29" stroke="#B7E4FC" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="23" cy="29" r="3" fill="#FFF7D6" opacity="0.8"/>
  </svg>`,

  seed_carrot: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="11" y="9" width="26" height="31" rx="5" fill="#F8EBCD" stroke="#B68A55" stroke-width="2.4"/>
    <path d="M11 15H37" stroke="#D8B380" stroke-width="2"/>
    <path d="M24 21C27.5 21 29 24.5 26 32C25 34.5 23 34.5 22 32C19 24.5 20.5 21 24 21Z" fill="#F28B42" stroke="#B8561A" stroke-width="1.8"/>
    <path d="M24 21C22 17 19 17 19 19M24 21C24 16 26 16 27 18M24 21C26.5 18 29 18 28.5 20" stroke="#5EA955" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  seed_radish: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="11" y="9" width="26" height="31" rx="5" fill="#FBE8EE" stroke="#BE788F" stroke-width="2.4"/>
    <path d="M11 15H37" stroke="#E0A5B7" stroke-width="2"/>
    <circle cx="24" cy="27" r="6" fill="#E86A8E" stroke="#A63C5B" stroke-width="1.8"/>
    <path d="M22 32C23.5 34 24.5 34 26 32" stroke="#FFF4F7" stroke-width="2" stroke-linecap="round"/>
    <path d="M24 21C21 17 18 18 19.5 20.5M24 21C27 17 30 18 28.5 20.5" stroke="#5EA955" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  seed_tomato: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="11" y="9" width="26" height="31" rx="5" fill="#FCECE6" stroke="#BF7763" stroke-width="2.4"/>
    <path d="M11 15H37" stroke="#E5A796" stroke-width="2"/>
    <circle cx="24" cy="27.5" r="6.5" fill="#EC5D4C" stroke="#A93326" stroke-width="1.8"/>
    <path d="M21 25C21.5 24 22.8 23.5 24 23.5" stroke="#FFB8AD" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M24 21L21.5 19M24 21L26.5 19M24 21V18" stroke="#539D4B" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  seed_pumpkin: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="11" y="9" width="26" height="31" rx="5" fill="#FBF0DB" stroke="#BD8947" stroke-width="2.4"/>
    <path d="M11 15H37" stroke="#E3BC82" stroke-width="2"/>
    <ellipse cx="24" cy="27.5" rx="7.5" ry="5.8" fill="#EB9434" stroke="#A65C15" stroke-width="1.8"/>
    <ellipse cx="24" cy="27.5" rx="3.5" ry="5.8" fill="#F4AA4E" stroke="#A65C15" stroke-width="1.4"/>
    <path d="M24 21.5C24 19 25.5 18 27 18.5" stroke="#5B8F45" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  animal_feed: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 26H37L34 37C33.5 39 31.8 40 29.8 40H18.2C16.2 40 14.5 39 14 37L11 26Z" fill="#C68952" stroke="#855228" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M13 26C14 19 19 16 24 16C29 16 34 19 35 26" fill="#F2CA63" stroke="#B88823" stroke-width="2"/>
    <circle cx="20" cy="21" r="1.7" fill="#FFF0B8"/>
    <circle cx="25" cy="19.5" r="1.8" fill="#FFF0B8"/>
    <circle cx="29" cy="22" r="1.6" fill="#D49A2A"/>
    <circle cx="23" cy="23.5" r="1.6" fill="#D49A2A"/>
  </svg>`,

  crop_carrot: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M28 19C32.5 23.5 23 36 16 39C14.5 39.6 13.4 38.5 14 37C17 30 23.5 14.5 28 19Z" fill="#F58B3B" stroke="#B55415" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M23 24L25.5 26.5M19.5 29.5L21.5 31.5" stroke="#FFD0A3" stroke-width="2" stroke-linecap="round"/>
    <path d="M28 19C29 13 33 10 35 12M28 19C33 16 37 16 37 19M28 19C26 14 27 10 30 10" stroke="#5AA950" stroke-width="2.8" stroke-linecap="round"/>
  </svg>`,

  crop_radish: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 20C31 20 35 25 34 31C33 36 27 38 24 41C21 38 15 36 14 31C13 25 17 20 24 20Z" fill="#E8658B" stroke="#A63455" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M19 35C21 37.5 23 39 24 40.5C25 39 27 37.5 29 35C26 35.8 22 35.8 19 35Z" fill="#FFF4F7"/>
    <path d="M24 20C20 13 14 13 15 17C16 19.5 20 20 24 20Z" fill="#68B85B" stroke="#3E7F35" stroke-width="1.8"/>
    <path d="M24 20C28 13 34 13 33 17C32 19.5 28 20 24 20Z" fill="#78C969" stroke="#3E7F35" stroke-width="1.8"/>
    <path d="M24 20C22 12 26 10 24 10" stroke="#3E7F35" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  crop_tomato: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="27" r="12" fill="#EE5C49" stroke="#A83223" stroke-width="2.2"/>
    <path d="M18 22C19.5 20 22 19 24 19" stroke="#FFB7AC" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M24 16L19 13M24 16L29 13M24 16L22 19M24 16L26 19M24 16V11" stroke="#4D9B46" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`,

  crop_pumpkin: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="28" rx="14" ry="10.5" fill="#EC902E" stroke="#A85810" stroke-width="2.2"/>
    <ellipse cx="24" cy="28" rx="7.5" ry="10.5" fill="#F5A645" stroke="#A85810" stroke-width="1.8"/>
    <ellipse cx="24" cy="28" rx="2.5" ry="10" fill="#FBC06C" opacity="0.55"/>
    <path d="M24 17.5C24 13 26.5 11 30 12" stroke="#5A8F44" stroke-width="3.2" stroke-linecap="round"/>
  </svg>`,

  prod_egg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 10C31 10 35.5 21 35.5 28.5C35.5 35.5 30.5 39.5 24 39.5C17.5 39.5 12.5 35.5 12.5 28.5C12.5 21 17 10 24 10Z" fill="#FFF2D6" stroke="#C19A61" stroke-width="2.4"/>
    <circle cx="20" cy="23" r="1.5" fill="#D4AA72"/>
    <circle cx="28" cy="28" r="1.8" fill="#D4AA72"/>
    <circle cx="23" cy="33" r="1.2" fill="#D4AA72"/>
    <path d="M19 16C20 14.2 21.5 13.5 23 13.5" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  prod_milk: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 10H29V15L33 21V37C33 38.7 31.7 40 30 40H18C16.3 40 15 38.7 15 37V21L19 15V10Z" fill="#F8FCFF" stroke="#6E9EBF" stroke-width="2.3" stroke-linejoin="round"/>
    <rect x="18" y="8" width="12" height="4" rx="1.8" fill="#E87A6D" stroke="#A6463B" stroke-width="1.6"/>
    <path d="M16 25H32V37C32 38.1 31.1 39 30 39H18C16.9 39 16 38.1 16 37V25Z" fill="#FFFDF7"/>
    <rect x="18.5" y="27.5" width="11" height="6" rx="2" fill="#B5E0FA"/>
  </svg>`,

  prod_wool: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="19" cy="22" r="8" fill="#FFFBF2" stroke="#C5B399" stroke-width="2"/>
    <circle cx="29" cy="21" r="8" fill="#FFFBF2" stroke="#C5B399" stroke-width="2"/>
    <circle cx="24" cy="29" r="9" fill="#FFFBF2" stroke="#C5B399" stroke-width="2"/>
    <circle cx="17" cy="29" r="6.5" fill="#FFFBF2"/>
    <circle cx="31" cy="29" r="6.5" fill="#FFFBF2"/>
    <path d="M21 24C22.5 22.5 25.5 22.5 27 24" stroke="#DFD0B8" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  prod_truffle: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 24C14 17 20 12 26 13C33 14 36 20 35 27C34 34 28 38 22 37C16 36 16 30 15 24Z" fill="#8C6244" stroke="#5A3A24" stroke-width="2.2"/>
    <circle cx="22" cy="21" r="2.2" fill="#B28463"/>
    <circle cx="29" cy="25" r="2" fill="#B28463"/>
    <circle cx="23" cy="30" r="1.8" fill="#6F4A30"/>
  </svg>`,

  water: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 9C24 9 35 22 35 29.5C35 35.8 30 40 24 40C18 40 13 35.8 13 29.5C13 22 24 9 24 9Z" fill="#67C0F0" stroke="#3784B3" stroke-width="2.4"/>
    <path d="M19 30C19 32.5 20.8 34.5 23 35" stroke="#D2F1FF" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`,

  heart: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 38C24 38 10 29 10 19C10 14 13.8 10.5 18.2 10.5C21 10.5 23 12 24 14C25 12 27 10.5 29.8 10.5C34.2 10.5 38 14 38 19C38 29 24 38 24 38Z" fill="#FF7CA3" stroke="#C7446E" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,

  sparkle: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 8L27.5 20.5L40 24L27.5 27.5L24 40L20.5 27.5L8 24L20.5 20.5L24 8Z" fill="#FFD966" stroke="#C9921F" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,

  basket: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 22C15 14 33 14 33 22" stroke="#9C6536" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M10 22H38L34.5 37C34 38.8 32.4 40 30.5 40H17.5C15.6 40 14 38.8 13.5 37L10 22Z" fill="#DDA164" stroke="#8C5629" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M13 28H35M14.5 34H33.5" stroke="#B67A40" stroke-width="2"/>
  </svg>`,

  crate: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="13" width="28" height="25" rx="3" fill="#D59A62" stroke="#855329" stroke-width="2.4"/>
    <path d="M10 21H38M10 30H38" stroke="#9D6738" stroke-width="2"/>
    <path d="M15 13L33 38" stroke="#B67A45" stroke-width="2.5"/>
  </svg>`,

  coin: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="14" fill="#FFD45B" stroke="#B8801C" stroke-width="2.6"/>
    <circle cx="24" cy="24" r="9.5" fill="#FFE68A" stroke="#D99B29" stroke-width="1.6"/>
    <path d="M24 17V31" stroke="#C5881E" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`,

  sun: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="9.5" fill="#FFD75E" stroke="#D49523" stroke-width="2.2"/>
    <path d="M24 7V11M24 37V41M7 24H11M37 24H41M12 12L15 15M33 33L36 36M36 12L33 15M15 33L12 36" stroke="#F0A830" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`,

  sunset: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 30C13 24 18 19 24 19C30 19 35 24 35 30" fill="#FF9A62" stroke="#C85D32" stroke-width="2.2"/>
    <path d="M8 31H40M13 36H35" stroke="#E08052" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M24 11V15M12 16L15 19M36 16L33 19" stroke="#F4A34A" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`,

  moon: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M31 12C22 12 15 19 15 27.5C15 33.5 19.8 38 26 38C31.5 38 35.8 34.5 37 29.5C32.5 31 27 28 26 23C25 18 27.5 14 31 12Z" fill="#FFE8A3" stroke="#C59C3C" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="35" cy="15" r="2" fill="#FFF3C4"/>
    <circle cx="14" cy="14" r="1.4" fill="#FFF3C4"/>
  </svg>`,

  fishing_rod: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 39C14 28 22 16 34 10" stroke="#A6743D" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M34 10C37 16 37 24 35 31" stroke="#62B6DC" stroke-width="1.8" stroke-dasharray="2 2"/>
    <circle cx="35" cy="33" r="3.6" fill="#EB584A" stroke="#7A241C" stroke-width="1.5"/>
    <path d="M31.5 33H38.5" stroke="#FFFFFF" stroke-width="1.8"/>
    <circle cx="16" cy="31" r="3.5" fill="#E3BC61" stroke="#8C6B28" stroke-width="1.6"/>
  </svg>`,

  hunting_bow: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 10C29 14 29 34 16 38" stroke="#A8693B" stroke-width="3.8" stroke-linecap="round"/>
    <path d="M16 10L16 38" stroke="#E5D8C0" stroke-width="1.8"/>
    <path d="M11 24H37" stroke="#8F5732" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M34 20L39 24L34 28" fill="#8C99A6" stroke="#4F5A66" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M10 21L14 24L10 27" stroke="#E86A5A" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  fish_carp: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 24C16 15 27 15 34 22L40 16V32L34 26C27 33 16 33 12 24Z" fill="#F5B84C" stroke="#B2761B" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="18" cy="22" r="2" fill="#2E231D"/>
    <path d="M23 19C25 22 25 26 23 29" stroke="#FFE19E" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  fish_trout: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 24C15 16 27 16 34 22L40 17V31L34 26C27 32 15 32 10 24Z" fill="#63BCA8" stroke="#317869" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="17" cy="22" r="2" fill="#23302E"/>
    <circle cx="24" cy="22" r="1.4" fill="#D4F5EC"/>
    <circle cx="28" cy="25" r="1.4" fill="#D4F5EC"/>
  </svg>`,

  fish_salmon: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 24C15 15 28 15 35 22L41 16V32L35 26C28 33 15 33 10 24Z" fill="#EE8373" stroke="#A6463B" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="17" cy="22" r="2" fill="#2E201D"/>
    <path d="M22 24H31" stroke="#FFC7BE" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  fish_koi: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 24C15 14 28 15 34 22L41 15V33L34 26C28 33 15 34 10 24Z" fill="#FFF7EB" stroke="#C9647E" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="23" cy="22" r="4.5" fill="#FF7CA3"/>
    <circle cx="16" cy="22" r="2" fill="#2E201D"/>
    <circle cx="30" cy="26" r="2.6" fill="#FFD159"/>
  </svg>`,

  hunt_pelt: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 14C19 11 29 11 34 14L38 22L34 36C29 38 19 38 14 36L10 22L14 14Z" fill="#D4B08C" stroke="#8C6643" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M19 19C22 17 26 17 29 19" stroke="#F5DFC8" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  hunt_meat: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="25" rx="13" ry="10" fill="#D66151" stroke="#8C3226" stroke-width="2.2"/>
    <circle cx="28" cy="24" r="3.4" fill="#FFF7EA" stroke="#C4B39B" stroke-width="1.6"/>
    <path d="M16 22C18 19 22 18 25 19" stroke="#F7A79B" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  hunt_venison: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 27C12 19 19 14 28 15C34 16 37 21 36 27C35 33 28 36 21 35C15 34 12 31 12 27Z" fill="#BA4E45" stroke="#7A2721" stroke-width="2.2"/>
    <circle cx="28" cy="24" r="3.2" fill="#FFF4E4" stroke="#BFA98E" stroke-width="1.6"/>
  </svg>`,

  hunt_antler: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 38C20 31 14 24 12 14M17 26L10 22M14 20L19 15" stroke="#DEC9A4" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M24 38C28 31 34 24 36 14M31 26L38 22M34 20L29 15" stroke="#DEC9A4" stroke-width="3.4" stroke-linecap="round"/>
  </svg>`,

  door: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="8" width="22" height="32" rx="3" fill="#B87A4B" stroke="#704625" stroke-width="2.4"/>
    <circle cx="30" cy="25" r="2.3" fill="#F5D06B"/>
    <circle cx="24" cy="16" r="4" fill="#FFEAA7" stroke="#85562E" stroke-width="1.6"/>
  </svg>`,

  hammer: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 36L28 22" stroke="#B57A46" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M22 14L34 26L38 22L26 10L22 14Z" fill="#8C99A6" stroke="#4F5A66" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,
};

export function getIconSvg(key?: IconKey): string {
  if (!key || !(key in ITEM_ICONS)) return ITEM_ICONS.sparkle;
  return ITEM_ICONS[key];
}
