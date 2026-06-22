"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SiteGnb } from "@/components/layout/site-gnb";
import { createPost, getPost, updatePost, type FeedPost } from "@/lib/api";
import type { SquareCategory } from "@/lib/community/categories";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadPostImages } from "@/lib/supabase/storage";

import "@/styles/weswim-write.css";

const MAX_IMAGES = 5;
const TITLE_MAX = 100;
const DRAFT_STORAGE_KEY = "weswim-community-write-draft";

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const WRITE_CATEGORIES: Array<{
  value: SquareCategory;
  pubValue: string;
  label: string;
}> = [
  { value: "info", pubValue: "info", label: "정보방" },
  { value: "tips", pubValue: "tip", label: "초보 팁" },
  { value: "venue", pubValue: "pool", label: "우리 수영장" },
  { value: "free", pubValue: "free", label: "자유게시판" },
  { value: "instructor", pubValue: "coach", label: "강사실 (강사 회원 전용)" },
];

export function CommunityWriteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPostId = searchParams.get("edit");
  const venueIdParam = searchParams.get("venue");
  const isEditMode = Boolean(editPostId);
  const [authLoading, setAuthLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(Boolean(editPostId));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const initialCategory =
    (searchParams.get("category") as SquareCategory | null) ?? "free";
  const [category, setCategory] = useState<SquareCategory>(
    WRITE_CATEGORIES.some((c) => c.value === initialCategory)
      ? initialCategory
      : "free",
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode || typeof window === "undefined") {
      return;
    }
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const draft = JSON.parse(raw) as {
        category?: SquareCategory;
        title?: string;
        content?: string;
        tagsInput?: string;
      };
      if (draft.category) {
        setCategory(draft.category);
      }
      if (draft.title) {
        setTitle(draft.title);
      }
      if (draft.content) {
        setContent(draft.content);
      }
      if (draft.tagsInput) {
        setTagsInput(draft.tagsInput);
      }
    } catch {
      /* ignore corrupt draft */
    }
  }, [isEditMode]);

  useEffect(() => {
    async function checkAuth() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(Boolean(session?.user));
      setAuthLoading(false);

      if (!session?.access_token || !editPostId) {
        setPostLoading(false);
        return;
      }

      try {
        const post = await getPost(editPostId, session.access_token);
        if (!post.is_author) {
          router.replace(`/community/${editPostId}`);
          return;
        }
        setCategory(post.category as SquareCategory);
        setTitle(post.title ?? "");
        setContent(post.content);
        setTagsInput(post.tags.join(", "));
        setExistingImageUrls(post.images.map((img) => img.url));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.",
        );
      } finally {
        setPostLoading(false);
      }
    }

    void checkAuth();
  }, [editPostId, router]);

  useEffect(() => {
    return () => {
      pendingImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [pendingImages]);

  function addImageFiles(fileList: FileList | null) {
    if (loading || !fileList?.length) {
      return;
    }
    const remaining =
      MAX_IMAGES - pendingImages.length - existingImageUrls.length;
    if (remaining <= 0) {
      setErrorMessage(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }

    const next: PendingImage[] = [];
    for (const file of Array.from(fileList).slice(0, remaining)) {
      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPendingImages((current) => [...current, ...next]);
    setErrorMessage(null);
  }

  function removeImage(id: string) {
    if (loading) {
      return;
    }
    setPendingImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("로그인이 필요합니다.");
      }

      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 10);

      const uploaded = await uploadPostImages(
        pendingImages.map((item) => item.file),
        session,
      );
      const image_urls = [...existingImageUrls, ...uploaded];

      if (isEditMode && editPostId) {
        await updatePost(
          editPostId,
          {
            category,
            title: title.trim() || null,
            content: content.trim(),
            tags,
            image_urls,
          },
          session.access_token,
        );
        router.push(`/community/${editPostId}`);
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);

        const post: FeedPost = await createPost(
          {
            category,
            title: title.trim() || null,
            content: content.trim(),
            tags,
            image_urls,
            venue_id:
              category === "venue" && venueIdParam ? venueIdParam : undefined,
          },
          session.access_token,
        );
        router.push(`/?created=${post.post_id}`);
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "글 작성에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  const pageTitle = isEditMode ? "게시글 수정" : "게시글 작성";

  if (authLoading || postLoading) {
    return (
      <>
        <SiteGnb activeNav="home" />
        <div className="community-write-screen">
          <div className="page">
            <p className="write-loading">로그인 상태 확인 중...</p>
          </div>
        </div>
      </>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <SiteGnb activeNav="home" />
        <div className="community-write-screen">
          <div className="page">
            <div className="page-header">
              <Link className="back-btn" href="/">
                <span className="ms">arrow_back</span> 커뮤니티
              </Link>
              <div className="page-title">{pageTitle}</div>
            </div>
            <div className="write-card">
              <div className="write-unavailable">
                게시글 작성은 로그인 후 이용할 수 있습니다.{" "}
                <Link href="/login">로그인하러 가기</Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const showCoachNotice = category === "instructor";

  return (
    <>
      <SiteGnb activeNav="home" />
      <div className="community-write-screen">
        <div className="page">
          <div className="page-header">
            <Link className="back-btn" href="/">
              <span className="ms">arrow_back</span> 커뮤니티
            </Link>
            <div className="page-title">{pageTitle}</div>
          </div>

          <form className="write-card" onSubmit={handleSubmit}>
          <div className="write-guide">
            <div className="guide-title">
              <span className="ms">tips_and_updates</span> 좋은 게시글이 되려면
            </div>
            <ul className="guide-list">
              <li>제목에 핵심 내용을 담아주세요</li>
              <li>경험을 구체적으로 적으면 도움이 돼요</li>
              <li>이미지는 이해를 돕는 데 효과적이에요 (최대 5장)</li>
              <li>해시태그로 검색이 쉬워집니다</li>
            </ul>
          </div>

          <div className="form-row">
            <div className="form-label">
              <span>
                게시판 선택 <span className="required">*</span>
              </span>
            </div>
            <select
              className="form-select"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as SquareCategory)
              }
              required
            >
              {WRITE_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className={`coach-notice${showCoachNotice ? " show" : ""}`}>
            <span className="ms">workspace_premium</span>
            강사실은 강사 뱃지 보유 회원만 작성할 수 있습니다. 강사 회원 전환은
            설정 → 회원 유형에서 신청하세요.
          </div>

          <div className="form-row">
            <div className="form-label">
              <span>
                제목 <span className="required">*</span>
              </span>
              <span
                className={`char-count${title.length > TITLE_MAX * 0.9 ? " near" : ""}`}
              >
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              className="form-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={TITLE_MAX}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-label">
              <span>
                내용 <span className="required">*</span>
              </span>
              <span
                className={`char-count${content.length > 4500 ? " near" : ""}`}
              >
                {content.length.toLocaleString()}/5,000
              </span>
            </div>
            <textarea
              className="form-textarea"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={
                "내용을 자유롭게 작성해보세요.\n\n수영 팁, 정보, 경험담 등 뭐든 좋아요!"
              }
              required
              minLength={1}
              maxLength={5000}
            />
          </div>

          <div className="form-row">
            <div className="form-label">태그 (선택, 쉼표로 구분)</div>
            <input
              className="form-input"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="예: 자유형, 호흡, 잠실"
            />
          </div>

          <div className="form-row">
            <div className="form-label">
              <span>이미지 첨부</span>
              <span className="label-hint">
                (최대 5장 · 장당 5MB · JPG/PNG/WEBP)
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              disabled={loading}
              onChange={(event) => {
                addImageFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <div
              className={`img-upload-area${loading ? " is-disabled" : ""}`}
              role="button"
              tabIndex={loading ? -1 : 0}
              aria-disabled={loading}
              onClick={() => {
                if (!loading) {
                  fileInputRef.current?.click();
                }
              }}
              onKeyDown={(event) => {
                if (loading) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                if (!loading) {
                  event.preventDefault();
                }
              }}
              onDrop={(event) => {
                if (loading) {
                  return;
                }
                event.preventDefault();
                addImageFiles(event.dataTransfer.files);
              }}
            >
              <span className="ms img-upload-icon" aria-hidden="true">
                add_photo_alternate
              </span>
              <div className="img-upload-label">
                클릭하거나 이미지를 드래그해서 업로드
              </div>
              <div className="img-upload-sub">JPG, PNG, WEBP · 장당 최대 5MB</div>
            </div>
            {existingImageUrls.length > 0 ? (
              <div className="img-previews">
                {existingImageUrls.map((url) => (
                  <div className="img-preview" key={url}>
                    <img alt="" src={url} />
                  </div>
                ))}
              </div>
            ) : null}
            {pendingImages.length > 0 ? (
              <div className="img-previews">
                {pendingImages.map((item) => (
                  <div className="img-preview" key={item.id}>
                    <img alt="" src={item.previewUrl} />
                    <button
                      type="button"
                      className="remove-img"
                      aria-label="이미지 제거"
                      disabled={loading}
                      onClick={() => removeImage(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="write-error">{errorMessage}</p>
          ) : null}

          {draftNotice ? (
            <p className="write-error" style={{ color: "var(--aqua-dark)" }}>
              {draftNotice}
            </p>
          ) : null}

          <div className="form-divider" />

          <div className="form-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                localStorage.setItem(
                  DRAFT_STORAGE_KEY,
                  JSON.stringify({ category, title, content, tagsInput }),
                );
                setDraftNotice("임시저장됐어요!");
              }}
            >
              <span className="ms" aria-hidden="true">
                save
              </span>
              임시저장
            </button>
            <Link className="btn btn-ghost" href="/">
              취소
            </Link>
            <button
              className="btn btn-aqua"
              disabled={
                loading ||
                !category ||
                !title.trim() ||
                !content.trim()
              }
              type="submit"
            >
              <span className="ms" aria-hidden="true">
                send
              </span>
              {loading
                ? isEditMode
                  ? "저장 중..."
                  : "등록 중..."
                : isEditMode
                  ? "수정 저장"
                  : "등록하기"}
            </button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
