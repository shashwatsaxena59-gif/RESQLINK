/**
 * Volunteer Task Repository
 * Persists mission tasks linking responders to emergency requests.
 */

import { BaseRepository } from './base-repository';
import { STORES } from '../indexeddb/schema';
import type { VolunteerTask, TaskLifecycleStatus } from '../../domain/models/volunteer-task';

export class VolunteerTaskRepository extends BaseRepository<VolunteerTask> {
  constructor() {
    super(STORES.VOLUNTEER_TASKS);
  }

  public async findByEmergencyRequestId(requestId: string): Promise<VolunteerTask[]> {
    const all = await this.findAll();
    return all.filter((t) => t.emergencyRequestId === requestId);
  }

  public async findByVolunteerId(volunteerId: string): Promise<VolunteerTask[]> {
    const all = await this.findAll();
    return all.filter((t) => t.volunteerId === volunteerId);
  }

  public async findByStatus(status: TaskLifecycleStatus): Promise<VolunteerTask[]> {
    const all = await this.findAll();
    return all.filter((t) => t.status === status);
  }

  /**
   * Finds any active/in-flight tasks currently assigned to a volunteer.
   */
  public async findActiveForVolunteer(volunteerId: string): Promise<VolunteerTask[]> {
    const all = await this.findByVolunteerId(volunteerId);
    return all.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  }

  /**
   * Finds the active task assigned to an emergency request (if any).
   */
  public async findActiveForRequest(requestId: string): Promise<VolunteerTask | null> {
    const all = await this.findByEmergencyRequestId(requestId);
    return all.find((t) => t.status !== 'completed' && t.status !== 'cancelled') ?? null;
  }
}

export const volunteerTaskRepo = new VolunteerTaskRepository();
