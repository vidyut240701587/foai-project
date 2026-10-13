export const plannerService = {
  generatePlan({ availableDays, dailyHours, subject, topics, examDate, topicFrequencies = {} }: { availableDays: number; dailyHours: number; subject: string; topics: string[]; examDate?: Date; topicFrequencies?: Record<string, number> }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planEnd = examDate ? new Date(examDate) : new Date(today.getTime() + (availableDays - 1) * 86400000);
    const dayCount = Math.max(1, Math.min(availableDays, Math.ceil((planEnd.getTime() - today.getTime()) / 86400000) + 1));
    const prioritizedTopics = [...topics].sort((left, right) => (topicFrequencies[right] ?? 0) - (topicFrequencies[left] ?? 0));
    const maxFrequency = Math.max(0, ...prioritizedTopics.map((topic) => topicFrequencies[topic] ?? 0));
    const topicsPerDay = Math.max(1, Math.ceil(prioritizedTopics.length / dayCount));
    const durationMinutes = Math.floor((dailyHours * 60) / topicsPerDay);
    const days = Array.from({ length: dayCount }, (_, dayIndex) => {
      const dayTopics = prioritizedTopics.filter((_, topicIndex) => topicIndex % dayCount === dayIndex);
      const scheduledAt = new Date(today.getTime() + dayIndex * 86400000);
      return {
        dayIndex: dayIndex + 1,
        scheduledAt,
        title: `${subject} study session`,
        summary: dayTopics.join(', '),
        tasks: dayTopics.map((topic, index) => ({
          topic,
          durationMinutes,
          priority: maxFrequency > 0
            ? (topicFrequencies[topic] ?? 0) === maxFrequency ? 1 : 2
            : topicIndexPriority(index, dayIndex),
          scheduledAt,
        })),
      };
    });
    return {
      subject,
      availableDays: dayCount,
      dailyHours,
      examDate: planEnd,
      days,
    };
  },
};

function topicIndexPriority(index: number, dayIndex: number) {
  return index === 0 && dayIndex === 0 ? 1 : 2;
}
