import type {
  User,
  Card,
  ReviewItem,
  QueueItem,
  UserSettings,
  CardInsight,
  InsightsQueueResponse,
  InsightsMetricsResponse,
} from '@/types'

export const mockUser: User = {
  id: 'user-1',
  google_sub: 'google-sub-123',
  email: 'learner@example.com',
  name: 'Dutch Learner',
  picture_url: 'https://via.placeholder.com/150',
  created_at: '2024-01-01T00:00:00Z',
  last_login: '2024-01-20T10:00:00Z',
}

export const mockCards: Card[] = [
  {
    id: 'CARD#card-1',
    card_id: 'card-1',
    user_id: 'user-1',
    front: 'de kat',
    back: 'the cat',
    explanation: 'de = common gender article',
    source: 'manual',
    tags: ['animals', 'nouns'],
    created_at: '2024-01-10T00:00:00Z',
  },
  {
    id: 'CARD#card-2',
    card_id: 'card-2',
    user_id: 'user-1',
    front: 'het huis',
    back: 'the house',
    explanation: 'het = neuter gender article',
    source: 'manual',
    tags: ['buildings', 'nouns'],
    created_at: '2024-01-10T00:00:00Z',
  },
  {
    id: 'CARD#card-3',
    card_id: 'card-3',
    user_id: 'user-1',
    front: 'ik loop naar huis',
    back: 'I walk home',
    explanation: 'lopen = to walk (infinitive), loop = I walk',
    source: 'manual',
    tags: ['verbs', 'phrases'],
    created_at: '2024-01-11T00:00:00Z',
  },
  {
    id: 'CARD#card-4',
    card_id: 'card-4',
    user_id: 'user-1',
    front: 'goedemorgen',
    back: 'good morning',
    source: 'manual',
    tags: ['greetings'],
    created_at: '2024-01-11T00:00:00Z',
  },
  {
    id: 'CARD#card-5',
    card_id: 'card-5',
    user_id: 'user-1',
    front: 'de fiets',
    back: 'the bicycle',
    explanation: 'fiets is feminine/masculine (de-word)',
    source: 'manual',
    tags: ['transport', 'nouns'],
    created_at: '2024-01-12T00:00:00Z',
  },
]

export const mockReviewItems: ReviewItem[] = [
  {
    id: 'review-1',
    card_id: 'card-1',
    user_id: 'user-1',
    direction: 'forward',
    state: 'REVIEW',
    interval: 7,
    ease_factor: 2.5,
    repetitions: 3,
    step_index: 0,
    due_date: '2024-01-20T00:00:00Z',
    last_reviewed: '2024-01-13T10:00:00Z',
    created_at: '2024-01-10T00:00:00Z',
  },
  {
    id: 'review-2',
    card_id: 'card-2',
    user_id: 'user-1',
    direction: 'forward',
    state: 'LEARNING',
    interval: 0,
    ease_factor: 2.5,
    repetitions: 0,
    step_index: 1,
    due_date: '2024-01-20T10:10:00Z',
    last_reviewed: '2024-01-20T10:00:00Z',
    created_at: '2024-01-10T00:00:00Z',
  },
  {
    id: 'review-3',
    card_id: 'card-3',
    user_id: 'user-1',
    direction: 'forward',
    state: 'NEW',
    interval: 0,
    ease_factor: 2.5,
    repetitions: 0,
    step_index: 0,
    due_date: '2024-01-20T00:00:00Z',
    created_at: '2024-01-11T00:00:00Z',
  },
  {
    id: 'review-4',
    card_id: 'card-4',
    user_id: 'user-1',
    direction: 'forward',
    state: 'NEW',
    interval: 0,
    ease_factor: 2.5,
    repetitions: 0,
    step_index: 0,
    due_date: '2024-01-20T00:00:00Z',
    created_at: '2024-01-11T00:00:00Z',
  },
  {
    id: 'review-5',
    card_id: 'card-5',
    user_id: 'user-1',
    direction: 'reverse',
    state: 'REVIEW',
    interval: 3,
    ease_factor: 2.4,
    repetitions: 2,
    step_index: 0,
    due_date: '2024-01-20T00:00:00Z',
    last_reviewed: '2024-01-17T14:00:00Z',
    created_at: '2024-01-12T00:00:00Z',
  },
]

export const mockQueue: QueueItem[] = [
  {
    ...mockReviewItems[0],
    review_item_id: mockReviewItems[0].id,
    last_reviewed: mockReviewItems[0].last_reviewed || null,
    front: mockCards[0].front,
    back: mockCards[0].back,
    explanation: mockCards[0].explanation,
  },
  {
    ...mockReviewItems[1],
    review_item_id: mockReviewItems[1].id,
    last_reviewed: mockReviewItems[1].last_reviewed || null,
    front: mockCards[1].front,
    back: mockCards[1].back,
    explanation: mockCards[1].explanation,
  },
  {
    ...mockReviewItems[2],
    review_item_id: mockReviewItems[2].id,
    last_reviewed: mockReviewItems[2].last_reviewed || null,
    front: mockCards[2].front,
    back: mockCards[2].back,
    explanation: mockCards[2].explanation,
  },
  {
    ...mockReviewItems[3],
    review_item_id: mockReviewItems[3].id,
    last_reviewed: mockReviewItems[3].last_reviewed || null,
    front: mockCards[3].front,
    back: mockCards[3].back,
    explanation: mockCards[3].explanation,
  },
  {
    ...mockReviewItems[4],
    review_item_id: mockReviewItems[4].id,
    last_reviewed: mockReviewItems[4].last_reviewed || null,
    front: mockCards[4].front,
    back: mockCards[4].back,
    explanation: mockCards[4].explanation,
  },
]

export const mockSettings: UserSettings = {
  user_id: 'user-1',
  new_cards_per_day: 20,
  max_reviews_per_day: null,
  learning_steps: [1, 10],
  relearning_steps: [10],
  graduating_interval: 1,
  easy_interval: 4,
  starting_ease: 2.5,
  easy_bonus: 1.3,
  interval_modifier: 1.0,
  maximum_interval: 36500,
  lapse_new_interval: 0,
  disabled_categories: [],
  show_unreviewed_insights: true,
  writing_exercises_per_day: 10,
  writing_session_enabled: true,
  updated_at: '2024-01-01T00:00:00Z',
}

// =============================================================================
// Integration test mock data
// =============================================================================

const approvedInsight: CardInsight = {
  type: 'compound',
  content: '"kat" comes from Latin "cattus"',
  status: 'approved',
  generated_at: '2024-01-15T00:00:00Z',
  reviewed_at: '2024-01-16T00:00:00Z',
  reviewed_by: 'human',
}

const pendingInsight: CardInsight = {
  type: 'verb_forms',
  content: 'lopen: ik loop, jij loopt, hij loopt',
  status: 'pending',
  generated_at: '2024-01-15T00:00:00Z',
}

const aiApprovedInsight: CardInsight = {
  type: 'root',
  content: '"huis" is related to English "house"',
  status: 'approved',
  generated_at: '2024-01-15T00:00:00Z',
  reviewed_at: '2024-01-15T12:00:00Z',
  reviewed_by: 'ai',
}

/** Cards with insights for integration tests (used by paginated cards endpoint) */
export const mockCardsWithInsights: Card[] = [
  {
    ...mockCards[0],
    insights: [approvedInsight],
  },
  {
    ...mockCards[1],
    insights: [aiApprovedInsight],
  },
  {
    ...mockCards[2],
    insights: [pendingInsight],
  },
  mockCards[3],
  mockCards[4],
]

/** Queue items where some cards carry approved insights */
export const mockQueueWithInsights: QueueItem[] = [
  {
    ...mockQueue[0],
    insights: [approvedInsight],
  },
  {
    ...mockQueue[1],
    insights: [aiApprovedInsight],
  },
  mockQueue[2],
  mockQueue[3],
  mockQueue[4],
]

/** Extra NEW cards for the continue/extra_new feature */
export const mockExtraNewCards: QueueItem[] = [
  {
    review_item_id: 'extra-review-1',
    card_id: 'extra-card-1',
    direction: 'forward',
    state: 'NEW',
    interval: 0,
    ease_factor: 2.5,
    repetitions: 0,
    step_index: 0,
    due_date: '2024-01-20T00:00:00Z',
    last_reviewed: null,
    front: 'de hond',
    back: 'the dog',
    explanation: 'hond = dog (de-word)',
  },
  {
    review_item_id: 'extra-review-2',
    card_id: 'extra-card-2',
    direction: 'forward',
    state: 'NEW',
    interval: 0,
    ease_factor: 2.5,
    repetitions: 0,
    step_index: 0,
    due_date: '2024-01-20T00:00:00Z',
    last_reviewed: null,
    front: 'de boom',
    back: 'the tree',
  },
  {
    review_item_id: 'extra-review-3',
    card_id: 'extra-card-3',
    direction: 'forward',
    state: 'NEW',
    interval: 0,
    ease_factor: 2.5,
    repetitions: 0,
    step_index: 0,
    due_date: '2024-01-20T00:00:00Z',
    last_reviewed: null,
    front: 'het boek',
    back: 'the book',
    explanation: 'boek = book (het-word)',
  },
]

/** Insights queue for the insights review page */
export const mockInsightsQueue: InsightsQueueResponse = {
  cards: [
    {
      card_id: 'card-1',
      front: 'de kat',
      back: 'the cat',
      insights: [
        {
          type: 'compound',
          content: '"kat" comes from Latin "cattus"',
          status: 'approved',
          generated_at: '2024-01-15T00:00:00Z',
          reviewed_at: '2024-01-15T12:00:00Z',
          reviewed_by: 'ai',
        },
        {
          type: 'example',
          content: 'De kat zit op de mat (The cat sits on the mat)',
          status: 'approved',
          generated_at: '2024-01-15T00:00:00Z',
          reviewed_at: '2024-01-15T12:00:00Z',
          reviewed_by: 'ai',
        },
      ],
    },
    {
      card_id: 'card-3',
      front: 'ik loop naar huis',
      back: 'I walk home',
      insights: [
        {
          type: 'verb_forms',
          content: 'lopen: ik loop, jij loopt, hij loopt',
          status: 'approved',
          generated_at: '2024-01-15T00:00:00Z',
          reviewed_at: '2024-01-15T12:00:00Z',
          reviewed_by: 'ai',
        },
      ],
    },
  ],
  total: 3,
}

/** Insights metrics data */
export function mockInsightsMetricsData(): InsightsMetricsResponse {
  return {
    period: 'day',
    datapoints: [
      {
        timestamp: '2024-01-20T08:00:00Z',
        approved: 5,
        rejected: 1,
        cardsProcessed: 4,
      },
      {
        timestamp: '2024-01-20T12:00:00Z',
        approved: 8,
        rejected: 2,
        cardsProcessed: 6,
      },
    ],
    totals: {
      approved: 13,
      rejected: 3,
      cardsProcessed: 10,
      approvalRate: 0.8125,
    },
  }
}
