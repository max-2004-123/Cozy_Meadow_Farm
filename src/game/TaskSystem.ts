import { TaskItem } from '../types';

export class TaskSystem {
  private tasks: TaskItem[] = [
    // Short starter tutorial objectives (front and center!)
    {
      id: 'tut_plant',
      title: 'Plant a seed in the garden',
      hint: 'Walk to the Vegetable Garden (left). Use Hoe [1] to till, then Seeds [3-6] to plant.',
      completed: false,
      isTutorial: true,
    },
    {
      id: 'tut_water',
      title: 'Water your planted crop',
      hint: 'Equip Watering Can [2] and click / press E on a planted soil plot.',
      completed: false,
      isTutorial: true,
    },
    {
      id: 'tut_chicken',
      title: 'Feed a chicken',
      hint: 'Visit the Animal Pasture (right), hold Animal Feed [7], and feed a chicken!',
      completed: false,
      isTutorial: true,
    },
    // Wholesome follow-up farm goals unlocked after tutorial
    {
      id: 'quest_harvest',
      title: 'Harvest a ripe vegetable',
      hint: 'Wait for a watered crop to sprout & ripen, then click / press E to harvest.',
      completed: false,
      isTutorial: false,
    },
    {
      id: 'quest_egg',
      title: 'Collect a fresh egg',
      hint: 'Happy fed chickens lay speckled eggs right beside them!',
      completed: false,
      isTutorial: false,
    },
    {
      id: 'quest_milk',
      title: 'Feed & milk a cow',
      hint: 'Feed Bella or Clover in the pasture, then interact to collect fresh milk.',
      completed: false,
      isTutorial: false,
    },
    {
      id: 'quest_friends',
      title: 'Care for a sheep or pig',
      hint: 'Feed Cotton, Marshmallow, Pip, or Truffle and collect wool or a truffle.',
      completed: false,
      isTutorial: false,
    },
  ];

  public tutorialCompleted = false;
  private listeners: ((completedTask?: TaskItem, tutorialJustFinished?: boolean) => void)[] = [];

  public onChange(cb: (completedTask?: TaskItem, tutorialJustFinished?: boolean) => void): void {
    this.listeners.push(cb);
  }

  public getVisibleTasks(): TaskItem[] {
    if (!this.tutorialCompleted) {
      return this.tasks.filter((t) => t.isTutorial);
    }
    return this.tasks.filter((t) => !t.isTutorial);
  }

  public getAllTasks(): TaskItem[] {
    return this.tasks;
  }

  public complete(id: string): void {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.completed) return;
    task.completed = true;

    let tutorialJustFinished = false;
    if (!this.tutorialCompleted && this.tasks.filter((t) => t.isTutorial).every((t) => t.completed)) {
      this.tutorialCompleted = true;
      tutorialJustFinished = true;
    }

    for (const cb of this.listeners) {
      cb(task, tutorialJustFinished);
    }
  }
}
