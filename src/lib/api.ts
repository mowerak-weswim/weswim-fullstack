export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ApiErrorBody = {
  detail?: string | Array<{ msg?: string }>;
};

function parseApiError(body: ApiErrorBody | null, fallback: string): string {
  const detail = body?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const message = detail.map((item) => item.msg).filter(Boolean).join(", ");
    if (message) {
      return message;
    }
  }
  return fallback;
}

async function parseJsonResponse<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(parseApiError(body, `${fallback}: ${res.status}`));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

function authHeaders(accessToken?: string): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export type PostAuthor = {
  nickname: string | null;
  user_type: string | null;
  level: string | null;
};

export type PostImage = {
  image_id: string;
  url: string;
  sort_order: number;
};

export type FeedPost = {
  post_id: string;
  user_id: string;
  sport_type: string | null;
  group_id: string | null;
  category: string;
  title: string | null;
  content: string;
  tags: string[];
  view_count: number;
  created_at: string;
  author: PostAuthor | null;
  reaction_count: number;
  comment_count: number;
  liked_by_me: boolean;
  bookmarked_by_me: boolean;
  images: PostImage[];
};

export type PostDetail = FeedPost & {
  is_author: boolean;
};

export type PostComment = {
  comment_id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  nickname: string | null;
  reaction_count: number;
  liked_by_me: boolean;
};

export type ReactionToggleResult = {
  liked: boolean;
  count: number;
};

export type BookmarkToggleResult = {
  bookmarked: boolean;
};

export type SortOption = "latest" | "popular" | "comment";

type GetPostsParams = {
  category?: string;
  sort?: SortOption;
  limit?: number;
  offset?: number;
};

export async function apiHealthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
  return parseJsonResponse(res, "API health check failed");
}

export async function getPosts(
  params: GetPostsParams = {},
  accessToken?: string,
): Promise<FeedPost[]> {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.sort) {
    searchParams.set("sort", params.sort);
  }
  searchParams.set("limit", String(params.limit ?? 20));
  searchParams.set("offset", String(params.offset ?? 0));

  const res = await fetch(`${API_BASE_URL}/api/v1/posts?${searchParams.toString()}`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /posts failed");
}

export async function getPost(
  postId: string,
  accessToken?: string,
): Promise<PostDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /posts/:id failed");
}

export type CreatePostPayload = {
  category: "info" | "tips" | "venue" | "free" | "instructor";
  title?: string | null;
  content: string;
  sport_type?: string | null;
  tags?: string[];
  image_urls?: string[];
  venue_id?: string;
};

export type UpdatePostPayload = {
  category?: CreatePostPayload["category"];
  title?: string | null;
  content?: string;
  tags?: string[];
  image_urls?: string[];
};

export async function createPost(
  payload: CreatePostPayload,
  accessToken: string,
): Promise<FeedPost> {
  const res = await fetch(`${API_BASE_URL}/api/v1/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res, "POST /posts failed");
}

export async function updatePost(
  postId: string,
  payload: UpdatePostPayload,
  accessToken: string,
): Promise<PostDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res, "PATCH /posts/:id failed");
}

export async function deletePost(
  postId: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  await parseJsonResponse(res, "DELETE /posts/:id failed");
}

export async function getPostComments(
  postId: string,
  accessToken?: string,
): Promise<PostComment[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/comments`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /posts/:id/comments failed");
}

export async function toggleCommentReaction(
  postId: string,
  commentId: string,
  accessToken: string,
): Promise<ReactionToggleResult> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/posts/${postId}/comments/${commentId}/reactions`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
    },
  );

  return parseJsonResponse(res, "POST comment reaction failed");
}

export async function createPostComment(
  postId: string,
  content: string,
  accessToken: string,
  parentCommentId?: string,
): Promise<PostComment> {
  const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({
      content,
      parent_comment_id: parentCommentId ?? null,
    }),
  });

  return parseJsonResponse(res, "POST /posts/:id/comments failed");
}

export async function updatePostComment(
  postId: string,
  commentId: string,
  content: string,
  accessToken: string,
): Promise<PostComment> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/posts/${postId}/comments/${commentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(accessToken),
      },
      body: JSON.stringify({ content }),
    },
  );

  return parseJsonResponse(res, "PATCH comment failed");
}

export async function deletePostComment(
  postId: string,
  commentId: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/posts/${postId}/comments/${commentId}`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
    },
  );

  await parseJsonResponse(res, "DELETE comment failed");
}

export async function togglePostReaction(
  postId: string,
  accessToken: string,
): Promise<ReactionToggleResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/reactions`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "POST /posts/:id/reactions failed");
}

export async function togglePostBookmark(
  postId: string,
  accessToken: string,
): Promise<BookmarkToggleResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/posts/${postId}/bookmarks`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "POST /posts/:id/bookmarks failed");
}

export type MonthlyStats = {
  year: number;
  month: number;
  total_distance: number;
  swim_days: number;
  goal_distance: number;
  goal_progress_pct: number;
};

export type SwimRecord = {
  record_id: string;
  user_id: string;
  sport_type: string;
  record_data: Record<string, unknown>;
  is_public: string;
  recorded_at: string;
  created_at: string;
};

export async function createRecord(
  payload: {
    record_data: Record<string, unknown>;
    is_public?: string;
    recorded_at?: string;
  },
  accessToken: string,
): Promise<SwimRecord> {
  const res = await fetch(`${API_BASE_URL}/api/v1/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({ sport_type: "swimming", ...payload }),
  });

  return parseJsonResponse(res, "POST /records failed");
}

export async function getRecords(
  accessToken: string,
  params?: { year?: number; month?: number; day?: number; limit?: number },
): Promise<SwimRecord[]> {
  const searchParams = new URLSearchParams();
  if (params?.year) {
    searchParams.set("year", String(params.year));
  }
  if (params?.month) {
    searchParams.set("month", String(params.month));
  }
  if (params?.day) {
    searchParams.set("day", String(params.day));
  }
  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }
  const qs = searchParams.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/records${qs ? `?${qs}` : ""}`,
    {
      cache: "no-store",
      headers: authHeaders(accessToken),
    },
  );

  return parseJsonResponse(res, "GET /records failed");
}

export async function getRecord(
  recordId: string,
  accessToken?: string,
): Promise<SwimRecord> {
  const res = await fetch(`${API_BASE_URL}/api/v1/records/${recordId}`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /records/:id failed");
}

export async function updateRecord(
  recordId: string,
  payload: {
    record_data?: Record<string, unknown>;
    is_public?: string;
    recorded_at?: string;
  },
  accessToken: string,
): Promise<SwimRecord> {
  const res = await fetch(`${API_BASE_URL}/api/v1/records/${recordId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res, "PATCH /records/:id failed");
}

export async function deleteRecord(
  recordId: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/records/${recordId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  await parseJsonResponse(res, "DELETE /records/:id failed");
}

export async function getMonthlyStats(
  accessToken: string,
  year?: number,
  month?: number,
): Promise<MonthlyStats> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", String(year));
  }
  if (month) {
    params.set("month", String(month));
  }
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/records/stats/monthly${qs ? `?${qs}` : ""}`,
    {
      cache: "no-store",
      headers: authHeaders(accessToken),
    },
  );

  return parseJsonResponse(res, "GET monthly stats failed");
}

export type NotificationItem = {
  noti_id: string;
  type: string;
  ref_id: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

export async function getNotifications(
  accessToken: string,
): Promise<NotificationItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /notifications failed");
}

export async function getUnreadNotificationCount(
  accessToken: string,
): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/api/v1/notifications/unread-count`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });
  const data = await parseJsonResponse<{ unread_count: number }>(
    res,
    "GET unread count failed",
  );
  return data.unread_count;
}

export type SearchResponse = {
  posts: Array<{
    post_id: string;
    title: string | null;
    content: string;
    category: string;
    created_at: string;
    nickname: string | null;
  }>;
  users: Array<{
    user_id: string;
    nickname: string;
    user_type: string;
    level: string | null;
  }>;
  venues: Array<{
    venue_id: string;
    name: string;
    region: string | null;
  }>;
};

export async function searchAll(query: string): Promise<SearchResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/search?q=${encodeURIComponent(query)}`,
    { cache: "no-store" },
  );

  return parseJsonResponse(res, "GET /search failed");
}

export type TrendingSearch = { label: string; rank: number };

export async function getTrendingSearches(): Promise<TrendingSearch[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/search/trending`, {
    cache: "no-store",
  });

  return parseJsonResponse(res, "GET /search/trending failed");
}

export type NotificationPrefs = {
  group_chat?: boolean;
  comment?: boolean;
  like?: boolean;
  system?: boolean;
};

export type UserProfile = {
  user_id: string;
  email: string;
  nickname: string;
  user_type: string;
  created_at: string;
  level: string | null;
  bio?: string | null;
  notification_prefs?: NotificationPrefs | null;
};

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}`, {
    cache: "no-store",
  });

  return parseJsonResponse(res, "GET /users/:id failed");
}

export type PublicUserSummary = {
  swim_days: number;
  total_distance: number;
  post_count: number;
};

export type PublicRecordItem = {
  record_id: string;
  record_data: Record<string, unknown>;
  recorded_at: string;
};

export type PublicGroupItem = {
  group_id: string;
  venue_name: string | null;
  level: string;
  status: string;
};

export async function getUserPublicSummary(
  userId: string,
): Promise<PublicUserSummary> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/summary`, {
    cache: "no-store",
  });

  return parseJsonResponse(res, "GET /users/:id/summary failed");
}

export async function getUserPublicRecords(
  userId: string,
  limit = 5,
): Promise<PublicRecordItem[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/users/${userId}/records?limit=${limit}`,
    { cache: "no-store" },
  );

  return parseJsonResponse(res, "GET /users/:id/records failed");
}

export async function getUserPublicPosts(
  userId: string,
  limit = 10,
  accessToken?: string,
): Promise<FeedPost[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/users/${userId}/posts?limit=${limit}`,
    {
      cache: "no-store",
      headers: authHeaders(accessToken),
    },
  );

  return parseJsonResponse(res, "GET /users/:id/posts failed");
}

export async function getUserPublicGroups(
  userId: string,
): Promise<PublicGroupItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/groups`, {
    cache: "no-store",
  });

  return parseJsonResponse(res, "GET /users/:id/groups failed");
}

export async function getMyProfile(accessToken: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /users/me failed");
}

export async function updateMyProfile(
  payload: {
    nickname?: string;
    level?: string;
    user_type?: "member" | "instructor";
    bio?: string;
    notification_prefs?: NotificationPrefs;
  },
  accessToken: string,
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res, "PATCH /users/me failed");
}

export async function deleteMyAccount(accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  await parseJsonResponse(res, "DELETE /users/me failed");
}

export type GroupMembership = {
  group_id: string;
  venue_name: string | null;
  level: string;
  schedule?: { days?: string[]; time?: string };
  status: string;
  role: string;
};

export async function getMyGroups(
  accessToken: string,
): Promise<GroupMembership[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/me/groups`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /users/me/groups failed");
}

export type GroupDetail = {
  group_id: string;
  venue_id: string | null;
  venue_name: string | null;
  sport_type: string;
  level: string;
  schedule: { days?: string[]; time?: string };
  status: string;
  member_count: number;
};

export type GroupMember = {
  user_id: string;
  nickname: string;
  role: string;
  joined_at: string;
};

export async function getGroup(groupId: string): Promise<GroupDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}`, {
    cache: "no-store",
  });

  return parseJsonResponse(res, "GET /groups/:id failed");
}

export async function getGroupMembers(
  groupId: string,
  accessToken: string,
): Promise<GroupMember[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/members`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /groups/:id/members failed");
}

export async function findGroup(
  payload: {
    venue_id: string;
    level: string;
    schedule: { days: string[]; time: string };
    create_if_missing?: boolean;
    join?: boolean;
  },
  accessToken: string,
): Promise<{
  group_id: string | null;
  status: string;
  message: string;
  is_member?: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/groups/find`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({ sport_type: "swimming", ...payload }),
  });

  return parseJsonResponse(res, "POST /groups/find failed");
}

export async function joinGroup(
  groupId: string,
  accessToken: string,
): Promise<{
  group_id: string | null;
  status: string;
  message: string;
  is_member?: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/join`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "POST /groups/:id/join failed");
}

export async function leaveGroup(
  groupId: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/leave`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  await parseJsonResponse(res, "DELETE /groups/:id/leave failed");
}

export type GroupTab = "notice" | "chat" | "etiquette";

export async function getGroupPosts(
  groupId: string,
  accessToken: string,
  tab: GroupTab = "chat",
  limit = 30,
): Promise<FeedPost[]> {
  const params = new URLSearchParams({ tab, limit: String(limit) });
  const res = await fetch(
    `${API_BASE_URL}/api/v1/groups/${groupId}/posts?${params}`,
    { cache: "no-store", headers: authHeaders(accessToken) },
  );

  return parseJsonResponse(res, "GET /groups/:id/posts failed");
}

export async function createGroupPost(
  groupId: string,
  payload: {
    category: "notice" | "chat" | "etiquette";
    content: string;
    title?: string | null;
    is_anonymous?: boolean;
  },
  accessToken: string,
): Promise<FeedPost> {
  const res = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res, "POST /groups/:id/posts failed");
}

export type RsvpCounts = {
  attending: number;
  maybe: number;
  declined: number;
};

export type VoteOptionItem = {
  option_id: string;
  label: string;
  sort_order: number;
  vote_count: number;
};

export type GroupSchedule = {
  schedule_id: string;
  group_id: string;
  user_id: string;
  author_nickname: string | null;
  type: "rsvp" | "vote";
  status: string;
  title: string | null;
  scheduled_at: string | null;
  location: string | null;
  deadline_at: string | null;
  created_at: string;
  is_author: boolean;
  rsvp_counts: RsvpCounts | null;
  my_rsvp: string | null;
  vote_options: VoteOptionItem[];
  my_vote_option_id: string | null;
  total_votes: number;
};

export async function getGroupSchedules(
  groupId: string,
  accessToken: string,
): Promise<GroupSchedule[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/schedules`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /groups/:id/schedules failed");
}

export async function getGroupSchedule(
  groupId: string,
  scheduleId: string,
  accessToken: string,
): Promise<GroupSchedule> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/groups/${groupId}/schedules/${scheduleId}`,
    { cache: "no-store", headers: authHeaders(accessToken) },
  );

  return parseJsonResponse(res, "GET /groups/:id/schedules/:sid failed");
}

export async function createGroupSchedule(
  groupId: string,
  payload: {
    type: "rsvp" | "vote";
    title: string;
    scheduled_at?: string | null;
    location?: string | null;
    deadline_at?: string | null;
    vote_options?: string[];
  },
  accessToken: string,
): Promise<GroupSchedule> {
  const res = await fetch(`${API_BASE_URL}/api/v1/groups/${groupId}/schedules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res, "POST /groups/:id/schedules failed");
}

export async function submitScheduleRsvp(
  groupId: string,
  scheduleId: string,
  response: "attending" | "maybe" | "declined",
  accessToken: string,
): Promise<GroupSchedule> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/groups/${groupId}/schedules/${scheduleId}/rsvp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(accessToken),
      },
      body: JSON.stringify({ response }),
    },
  );

  return parseJsonResponse(res, "POST schedule rsvp failed");
}

export async function submitScheduleVote(
  groupId: string,
  scheduleId: string,
  optionId: string,
  accessToken: string,
): Promise<GroupSchedule> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/groups/${groupId}/schedules/${scheduleId}/vote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(accessToken),
      },
      body: JSON.stringify({ option_id: optionId }),
    },
  );

  return parseJsonResponse(res, "POST schedule vote failed");
}

export async function confirmGroupSchedule(
  groupId: string,
  scheduleId: string,
  payload: {
    option_id: string;
    scheduled_at?: string | null;
    location?: string | null;
  },
  accessToken: string,
): Promise<GroupSchedule> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/groups/${groupId}/schedules/${scheduleId}/confirm`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(accessToken),
      },
      body: JSON.stringify(payload),
    },
  );

  return parseJsonResponse(res, "PATCH schedule confirm failed");
}

export type ScheduleComment = {
  comment_id: string;
  schedule_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  nickname: string | null;
};

export async function getScheduleComments(
  groupId: string,
  scheduleId: string,
  accessToken: string,
): Promise<ScheduleComment[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/groups/${groupId}/schedules/${scheduleId}/comments`,
    { cache: "no-store", headers: authHeaders(accessToken) },
  );

  return parseJsonResponse(res, "GET schedule comments failed");
}

export async function createScheduleComment(
  groupId: string,
  scheduleId: string,
  content: string,
  accessToken: string,
  parentCommentId?: string,
): Promise<ScheduleComment> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/groups/${groupId}/schedules/${scheduleId}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(accessToken),
      },
      body: JSON.stringify({
        content,
        parent_comment_id: parentCommentId ?? null,
      }),
    },
  );

  return parseJsonResponse(res, "POST schedule comment failed");
}

export type VenueItem = {
  venue_id: string;
  name: string;
  region: string | null;
  address: string | null;
  status?: string | null;
};

export async function listVenues(
  q?: string,
  accessToken?: string,
  limit = 100,
): Promise<VenueItem[]> {
  const params = new URLSearchParams();
  if (q?.trim()) {
    params.set("q", q.trim());
  }
  params.set("limit", String(limit));
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/venues?${qs}`,
    { cache: "no-store", headers: authHeaders(accessToken) },
  );

  return parseJsonResponse(res, "GET /venues failed");
}

export async function requestVenue(
  payload: { name: string; address: string; region?: string | null },
  accessToken: string,
): Promise<{ venue_id: string; name: string; status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/venues/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(res, "POST /venues/request failed");
}

export type VenueDetail = VenueItem & {
  group_count: number;
  post_count: number;
};

export type VenuePost = {
  post_id: string;
  title: string | null;
  content: string;
  category: string;
  tags: string[];
  view_count: number;
  reaction_count: number;
  comment_count: number;
  created_at: string;
  nickname: string | null;
};

export async function getVenue(venueId: string): Promise<VenueDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/venues/${venueId}`, {
    cache: "no-store",
  });

  return parseJsonResponse(res, "GET /venues/:id failed");
}

export async function getVenuePosts(
  venueId: string,
  params: { sort?: "latest" | "popular"; limit?: number; offset?: number } = {},
): Promise<VenuePost[]> {
  const search = new URLSearchParams();
  if (params.sort) {
    search.set("sort", params.sort);
  }
  if (params.limit != null) {
    search.set("limit", String(params.limit));
  }
  if (params.offset != null) {
    search.set("offset", String(params.offset));
  }
  const qs = search.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/venues/${venueId}/posts${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );

  return parseJsonResponse(res, "GET /venues/:id/posts failed");
}

export async function markAllNotificationsRead(
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/notifications/read`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
  });

  await parseJsonResponse(res, "PATCH /notifications/read failed");
}

export async function markNotificationRead(
  notiId: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/notifications/${notiId}/read`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
  });

  await parseJsonResponse(res, "PATCH /notifications/:id/read failed");
}

export type BadgeDefinition = {
  badge_id: string;
  category: string;
  level: string | null;
  condition_type: string;
  condition_value: number;
  label: string;
  icon: string;
};

export type UserBadgeItem = {
  badge_id: string;
  label: string;
  icon: string;
  category: string;
  db_category: string;
  ui_category: "distance" | "daily" | "attend" | "special";
  level: string | null;
  earned_count: number;
  is_master: boolean;
  earned_at: string;
};

export type BadgeProgressItem = {
  badge_id: string;
  label: string;
  icon: string;
  db_category: string;
  ui_category: "distance" | "daily" | "attend" | "special";
  current_value: number;
  condition_value: number;
  progress_pct: number;
};

export type MyBadgesResponse = {
  earned: UserBadgeItem[];
  in_progress: BadgeProgressItem[];
};

export async function listBadges(): Promise<BadgeDefinition[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/badges`, { cache: "no-store" });
  return parseJsonResponse(res, "GET /badges failed");
}

export async function getMyBadges(accessToken: string): Promise<MyBadgesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/badges/my`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  return parseJsonResponse(res, "GET /badges/my failed");
}

export async function getUserBadges(userId: string): Promise<UserBadgeItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/badges/users/${userId}`, {
    cache: "no-store",
  });

  return parseJsonResponse(res, "GET /badges/users/:id failed");
}

export type CreateUserReportPayload = {
  reason_code: "spam" | "abuse" | "fake" | "other";
};

export async function reportUser(
  userId: string,
  payload: CreateUserReportPayload,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/${userId}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });
  await parseJsonResponse(res, "POST /users/:id/reports failed");
}
