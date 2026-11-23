import { AnimalSpecies, CropDefinition, CropType, ItemDefinition, ItemId } from '../types';

export const ITEMS: Record<ItemId, ItemDefinition> = {
  hoe: {
    id: 'hoe',
    name: 'Garden Hoe',
    shortName: 'Hoe',
    category: 'tool',
    description: 'Till grassy garden plots into soft furrowed soil.',
    accentColor: '#c98a5b',
  },
  watering_can: {
    id: 'watering_can',
    name: 'Watering Can',
    shortName: 'Water',
    category: 'tool',
    description: 'Water planted soil so crops grow lush and fast. Refill at the barrel or pond.',
    accentColor: '#66b8e8',
  },
  seed_carrot: {
    id: 'seed_carrot',
    name: 'Carrot Seeds',
    shortName: 'Carrot',
    category: 'seed',
    description: 'Grows sweet crunchy orange carrots.',
    accentColor: '#f28b42',
    cropType: 'carrot',
  },
  seed_radish: {
    id: 'seed_radish',
    name: 'Radish Seeds',
    shortName: 'Radish',
    category: 'seed',
    description: 'Quick-growing rosy-pink storybook radishes.',
    accentColor: '#e4698a',
    cropType: 'radish',
  },
  seed_tomato: {
    id: 'seed_tomato',
    name: 'Tomato Seeds',
    shortName: 'Tomato',
    category: 'seed',
    description: 'Sunny vine tomatoes bursting with flavor.',
    accentColor: '#e95a4b',
    cropType: 'tomato',
  },
  seed_pumpkin: {
    id: 'seed_pumpkin',
    name: 'Pumpkin Seeds',
    shortName: 'Pumpkin',
    category: 'seed',
    description: 'Plump golden autumn pumpkins.',
    accentColor: '#e59233',
    cropType: 'pumpkin',
  },
  animal_feed: {
    id: 'animal_feed',
    name: 'Animal Feed',
    shortName: 'Feed',
    category: 'feed',
    description: 'Wholesome golden grain mix loved by chickens, cows, sheep, and pigs.',
    accentColor: '#e8bc52',
  },
  crop_carrot: {
    id: 'crop_carrot',
    name: 'Crisp Carrot',
    shortName: 'Carrot',
    category: 'crop',
    description: 'Freshly harvested sweet garden carrot.',
    accentColor: '#f28b42',
    sellValue: 12,
  },
  crop_radish: {
    id: 'crop_radish',
    name: 'Rosy Radish',
    shortName: 'Radish',
    category: 'crop',
    description: 'Plump, rosy-cheeked garden radish.',
    accentColor: '#e4698a',
    sellValue: 10,
  },
  crop_tomato: {
    id: 'crop_tomato',
    name: 'Sun Tomato',
    shortName: 'Tomato',
    category: 'crop',
    description: 'Juicy vine-ripened cherry tomatoes.',
    accentColor: '#e95a4b',
    sellValue: 15,
  },
  crop_pumpkin: {
    id: 'crop_pumpkin',
    name: 'Cozy Pumpkin',
    shortName: 'Pumpkin',
    category: 'crop',
    description: 'A hearty storybook pumpkin.',
    accentColor: '#e59233',
    sellValue: 24,
  },
  prod_egg: {
    id: 'prod_egg',
    name: 'Fresh Egg',
    shortName: 'Egg',
    category: 'product',
    description: 'Warm speckled egg laid by a happy chicken.',
    accentColor: '#f5d99b',
    sellValue: 14,
  },
  prod_milk: {
    id: 'prod_milk',
    name: 'Fresh Milk',
    shortName: 'Milk',
    category: 'product',
    description: 'Creamy farm milk in a cozy glass bottle.',
    accentColor: '#8ecae6',
    sellValue: 20,
  },
  prod_wool: {
    id: 'prod_wool',
    name: 'Fluffy Wool',
    shortName: 'Wool',
    category: 'product',
    description: 'Cloud-soft wool brushed from a happy sheep.',
    accentColor: '#f1e7d5',
    sellValue: 18,
  },
  prod_truffle: {
    id: 'prod_truffle',
    name: 'Meadow Truffle',
    shortName: 'Truffle',
    category: 'product',
    description: 'A prized woodland truffle rooted up by a cheerful pig.',
    accentColor: '#a67b5b',
    sellValue: 28,
  },
};

export const CROPS: Record<CropType, CropDefinition> = {
  radish: {
    type: 'radish',
    name: 'Rosy Radish',
    seedId: 'seed_radish',
    harvestId: 'crop_radish',
    stageDuration: 6.0,
    totalStages: 3,
    harvestYield: 2,
    bonusSeedChance: 0.9,
    accentColor: '#e4698a',
  },
  carrot: {
    type: 'carrot',
    name: 'Crisp Carrot',
    seedId: 'seed_carrot',
    harvestId: 'crop_carrot',
    stageDuration: 7.0,
    totalStages: 3,
    harvestYield: 2,
    bonusSeedChance: 0.9,
    accentColor: '#f28b42',
  },
  tomato: {
    type: 'tomato',
    name: 'Sun Tomato',
    seedId: 'seed_tomato',
    harvestId: 'crop_tomato',
    stageDuration: 8.5,
    totalStages: 3,
    harvestYield: 2,
    bonusSeedChance: 0.85,
    accentColor: '#e95a4b',
  },
  pumpkin: {
    type: 'pumpkin',
    name: 'Cozy Pumpkin',
    seedId: 'seed_pumpkin',
    harvestId: 'crop_pumpkin',
    stageDuration: 10.0,
    totalStages: 3,
    harvestYield: 1,
    bonusSeedChance: 1.0,
    accentColor: '#e59233',
  },
};

export const DEFAULT_HOTBAR: ItemId[] = [
  'hoe',
  'watering_can',
  'seed_carrot',
  'seed_radish',
  'seed_tomato',
  'seed_pumpkin',
  'animal_feed',
  'crop_carrot',
  'prod_egg',
];

export const WATERING_CAN_MAX = 100;
export const WATERING_CAN_COST = 16; // ~6 waterings per full can

export interface AnimalSpawnSpec {
  name: string;
  species: AnimalSpecies;
  x: number;
  z: number;
  variant: number;
  productId: ItemId;
  productName: string;
}

export const INITIAL_ANIMALS: AnimalSpawnSpec[] = [
  { name: 'Clucky', species: 'chicken', x: 7.2, z: 9.8, variant: 0, productId: 'prod_egg', productName: 'Fresh Egg' },
  { name: 'Buttercup', species: 'chicken', x: 9.5, z: 8.4, variant: 1, productId: 'prod_egg', productName: 'Fresh Egg' },
  { name: 'Peep', species: 'chicken', x: 8.4, z: 11.2, variant: 2, productId: 'prod_egg', productName: 'Fresh Egg' },
  { name: 'Bella', species: 'cow', x: 15.8, z: 3.4, variant: 0, productId: 'prod_milk', productName: 'Fresh Milk' },
  { name: 'Clover', species: 'cow', x: 19.8, z: 5.5, variant: 1, productId: 'prod_milk', productName: 'Fresh Milk' },
  { name: 'Cotton', species: 'sheep', x: 16.5, z: 10.6, variant: 0, productId: 'prod_wool', productName: 'Fluffy Wool' },
  { name: 'Marshmallow', species: 'sheep', x: 20.4, z: 9.4, variant: 1, productId: 'prod_wool', productName: 'Fluffy Wool' },
  { name: 'Pip', species: 'pig', x: 9.6, z: 2.5, variant: 0, productId: 'prod_truffle', productName: 'Meadow Truffle' },
  { name: 'Truffle', species: 'pig', x: 12.2, z: 4.1, variant: 1, productId: 'prod_truffle', productName: 'Meadow Truffle' },
];

export const WORLD_CONFIG = {
  spawnPos: { x: 0, y: 1.72, z: 23.2 },
  spawnYaw: 0,
  worldBounds: { minX: -34, maxX: 34, minZ: -31, maxZ: 28 },
  pastureBounds: { minX: 5.2, maxX: 22.6, minZ: -0.6, maxZ: 13.0 },
  pondCenter: { x: -5.5, z: -18.8 },
  pondRadiusX: 6.8,
  pondRadiusZ: 5.0,
  waterBarrelPos: { x: -4.1, z: 3.5 },
  supplyCratePos: { x: -4.1, z: 11.4 },
  marketStandPos: { x: -4.5, z: 15.0 },
};
