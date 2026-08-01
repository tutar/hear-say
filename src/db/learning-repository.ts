import { db } from './database'
import { createReviewPlan, createReviewSchedule, DEFAULT_REVIEW_INTERVALS } from '../domain/review-plan'
import type { LearningSession, LearningTimeSlice, ReviewInterval, ReviewPlan, ReviewSchedule } from '../domain/types'

export class LearningRepository {
  async currentReviewPlan(now = new Date().toISOString()): Promise<ReviewPlan> {
    return db.transaction('rw', db.reviewPlans, async () => {
      const latest = await db.reviewPlans.orderBy('version').last()
      if (latest) return latest
      const plan = createReviewPlan(1, DEFAULT_REVIEW_INTERVALS, now)
      await db.reviewPlans.add(plan)
      return plan
    })
  }

  async createNextReviewPlan(intervals: ReviewInterval[], now = new Date().toISOString()): Promise<ReviewPlan> {
    const current = await this.currentReviewPlan(now)
    const plan = createReviewPlan(current.version + 1, intervals, now)
    await db.reviewPlans.add(plan)
    return plan
  }

  async scheduleMaterial(materialId: string, completedAt: string): Promise<ReviewSchedule> {
    const existing = await db.reviewSchedules.where('materialId').equals(materialId).first()
    if (existing) return existing
    const schedule = createReviewSchedule(materialId, await this.currentReviewPlan(completedAt), completedAt)
    await db.reviewSchedules.add(schedule)
    return schedule
  }

  async scheduleForMaterial(materialId: string): Promise<ReviewSchedule | undefined> { return db.reviewSchedules.where('materialId').equals(materialId).first() }
  async dueSchedules(now = new Date().toISOString()): Promise<ReviewSchedule[]> { return (await db.reviewSchedules.where('status').equals('active').toArray()).filter((item) => item.nextReviewAt !== null && item.nextReviewAt <= now) }
  async saveSchedule(schedule: ReviewSchedule): Promise<void> { await db.reviewSchedules.put(schedule) }

  async activeSession(): Promise<LearningSession | undefined> { return db.learningSessions.where('status').equals('active').first() }
  async session(id: string): Promise<LearningSession | undefined> { return db.learningSessions.get(id) }
  async saveActiveSession(session: LearningSession, slices: LearningTimeSlice[] = []): Promise<void> {
    const stored = await db.learningSessions.get(session.id)
    if (stored && stored.status !== 'active') throw new Error('ended learning sessions are immutable')
    await db.transaction('rw', db.learningSessions, db.learningTimeSlices, async () => { await db.learningSessions.put(session); if (slices.length) await db.learningTimeSlices.bulkPut(slices) })
  }
  async timeSlices(): Promise<LearningTimeSlice[]> { return db.learningTimeSlices.orderBy('startedAt').toArray() }

  async deleteForMaterial(materialId: string): Promise<void> {
    const sessions = await db.learningSessions.where('materialId').equals(materialId).primaryKeys()
    await db.transaction('rw', db.reviewSchedules, db.learningSessions, db.learningTimeSlices, async () => {
      await db.reviewSchedules.where('materialId').equals(materialId).delete()
      await db.learningSessions.where('materialId').equals(materialId).delete()
      await db.learningTimeSlices.where('materialId').equals(materialId).delete()
    })
    void sessions
  }
}
