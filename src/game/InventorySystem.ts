import {
  DEFAULT_HOTBAR,
  ITEMS,
  WATERING_CAN_COST,
  WATERING_CAN_MAX,
} from '../config/farmConfig';
import { ItemId } from '../types';

export class InventorySystem {
  public hotbar: ItemId[] = [...DEFAULT_HOTBAR];
  public selectedSlot = 0; // Starts on Garden Hoe (slot 1)
  public waterLevel = WATERING_CAN_MAX;
  public coins = 25;

  private counts: Record<ItemId, number> = {
    hoe: 1,
    watering_can: 1,
    seed_carrot: 8,
    seed_radish: 6,
    seed_tomato: 6,
    seed_pumpkin: 4,
    animal_feed: 12,
    crop_carrot: 0,
    crop_radish: 0,
    crop_tomato: 0,
    crop_pumpkin: 0,
    prod_egg: 0,
    prod_milk: 0,
    prod_wool: 0,
    prod_truffle: 0,
  };

  private listeners: (() => void)[] = [];

  public onChange(cb: () => void): void {
    this.listeners.push(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  public getSelectedItemId(): ItemId {
    return this.hotbar[this.selectedSlot];
  }

  public selectSlot(index: number): void {
    const wrapped = ((index % this.hotbar.length) + this.hotbar.length) % this.hotbar.length;
    if (wrapped !== this.selectedSlot) {
      this.selectedSlot = wrapped;
      this.emit();
    }
  }

  public stepSlot(delta: number): void {
    this.selectSlot(this.selectedSlot + delta);
  }

  public equipItem(id: ItemId): void {
    const existing = this.hotbar.indexOf(id);
    if (existing !== -1) {
      this.selectSlot(existing);
      return;
    }
    // Put crops into slot 7 (8th), animal products into slot 8 (9th)
    const cat = ITEMS[id].category;
    const targetSlot = cat === 'product' ? 8 : 7;
    this.hotbar[targetSlot] = id;
    this.selectedSlot = targetSlot;
    this.emit();
  }

  public getCount(id: ItemId): number {
    return this.counts[id] ?? 0;
  }

  public addItem(id: ItemId, amount = 1): void {
    this.counts[id] = (this.counts[id] ?? 0) + amount;
    // Automatically show newly collected crop or animal product in hotbar slots 8/9 if currently empty
    const cat = ITEMS[id].category;
    if (cat === 'crop' && this.getCount(this.hotbar[7]) === 0) {
      this.hotbar[7] = id;
    } else if (cat === 'product' && this.getCount(this.hotbar[8]) === 0) {
      this.hotbar[8] = id;
    }
    this.emit();
  }

  public consumeItem(id: ItemId, amount = 1): boolean {
    if (ITEMS[id].category === 'tool') return true;
    const cur = this.counts[id] ?? 0;
    if (cur < amount) return false;
    this.counts[id] = cur - amount;
    this.emit();
    return true;
  }

  public hasWater(): boolean {
    return this.waterLevel >= WATERING_CAN_COST;
  }

  public useWater(): boolean {
    if (this.waterLevel < WATERING_CAN_COST) return false;
    this.waterLevel = Math.max(0, this.waterLevel - WATERING_CAN_COST);
    this.emit();
    return true;
  }

  public refillWater(): boolean {
    if (this.waterLevel >= WATERING_CAN_MAX) return false;
    this.waterLevel = WATERING_CAN_MAX;
    this.emit();
    return true;
  }

  public restockSupplies(): { addedAnything: boolean; summary: string } {
    const targets: Partial<Record<ItemId, number>> = {
      seed_carrot: 8,
      seed_radish: 6,
      seed_tomato: 6,
      seed_pumpkin: 4,
      animal_feed: 12,
    };
    let added = 0;
    for (const [id, minQty] of Object.entries(targets) as [ItemId, number][]) {
      if (this.counts[id] < minQty) {
        added += minQty - this.counts[id];
        this.counts[id] = minQty;
      }
    }
    if (added > 0) {
      this.emit();
      return { addedAnything: true, summary: `Restocked ${added} seeds & feed from the farm crate!` };
    }
    return { addedAnything: false, summary: 'Your seed pouches & feed bag are already full!' };
  }

  public getHarvestedSummary(): { id: ItemId; count: number }[] {
    const harvestIds: ItemId[] = [
      'crop_carrot',
      'crop_radish',
      'crop_tomato',
      'crop_pumpkin',
      'prod_egg',
      'prod_milk',
      'prod_wool',
      'prod_truffle',
    ];
    return harvestIds.map((id) => ({ id, count: this.counts[id] }));
  }

  public getTotalSellableValue(): { totalItems: number; totalCoins: number } {
    let totalItems = 0;
    let totalCoins = 0;
    for (const entry of this.getHarvestedSummary()) {
      if (entry.count > 0) {
        totalItems += entry.count;
        totalCoins += entry.count * (ITEMS[entry.id].sellValue ?? 10);
      }
    }
    return { totalItems, totalCoins };
  }

  public sellAllGoods(): { itemsSold: number; earned: number } {
    let itemsSold = 0;
    let earned = 0;
    for (const entry of this.getHarvestedSummary()) {
      if (entry.count > 0) {
        itemsSold += entry.count;
        earned += entry.count * (ITEMS[entry.id].sellValue ?? 10);
        this.counts[entry.id] = 0;
      }
    }
    if (itemsSold > 0) {
      this.coins += earned;
      this.emit();
    }
    return { itemsSold, earned };
  }
}
