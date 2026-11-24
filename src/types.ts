import * as THREE from 'three';

export type CropType = 'carrot' | 'radish' | 'tomato' | 'pumpkin';

export type AnimalSpecies = 'chicken' | 'cow' | 'sheep' | 'pig';

export type ItemId =
  | 'hoe'
  | 'watering_can'
  | 'fishing_rod'
  | 'hunting_bow'
  | 'seed_carrot'
  | 'seed_radish'
  | 'seed_tomato'
  | 'seed_pumpkin'
  | 'animal_feed'
  | 'crop_carrot'
  | 'crop_radish'
  | 'crop_tomato'
  | 'crop_pumpkin'
  | 'prod_egg'
  | 'prod_milk'
  | 'prod_wool'
  | 'prod_truffle'
  | 'fish_carp'
  | 'fish_trout'
  | 'fish_salmon'
  | 'fish_koi'
  | 'hunt_pelt'
  | 'hunt_meat'
  | 'hunt_venison'
  | 'hunt_antler';

export type ItemCategory = 'tool' | 'seed' | 'feed' | 'crop' | 'product' | 'fish' | 'hunt';

export interface ItemDefinition {
  id: ItemId;
  name: string;
  shortName: string;
  category: ItemCategory;
  description: string;
  accentColor: string;
  cropType?: CropType;
  sellValue?: number;
}

export interface CropDefinition {
  type: CropType;
  name: string;
  seedId: ItemId;
  harvestId: ItemId;
  stageDuration: number; // seconds per stage while watered
  totalStages: number; // 3 = stages 0,1,2,3 (3 is ripe)
  harvestYield: number;
  bonusSeedChance: number;
  accentColor: string;
}

export type SoilState = 'untilled' | 'tilled';

export interface InteractionInfo {
  id: string;
  title: string;
  subtitle?: string;
  actionText: string;
  hintText?: string;
  canAct: boolean;
  iconId?: ItemId | 'water' | 'heart' | 'sparkle' | 'basket' | 'crate' | 'door' | 'hammer' | 'moon';
  progress?: number; // 0..1 for crop growth
  progressLabel?: string;
  moisture?: number; // 0..1 for soil moisture
  badge?: {
    text: string;
    tone: 'good' | 'warn' | 'info' | 'happy';
  };
}

export interface InteractableTarget {
  id: string;
  object: THREE.Object3D;
  maxDistance: number;
  getInfo: () => InteractionInfo;
  interact: () => boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  hint: string;
  completed: boolean;
  isTutorial: boolean;
  progress?: number;
  target?: number;
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'default' | 'success' | 'info' | 'celebrate';
}

export interface TimeOfDayInfo {
  day: number;
  normalizedTime: number; // 0..1 (0 = midnight, 0.25 = 6am, 0.5 = noon, 0.75 = 6pm)
  hours: number;
  minutes: number;
  formattedTime: string;
  phase: 'Dawn' | 'Morning' | 'Afternoon' | 'Sunset' | 'Twilight' | 'Night';
  isNight: boolean;
}
