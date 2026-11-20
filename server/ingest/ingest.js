import { Inngest } from "inngest";
import prisma from "../config/prisma.js";

export const inngest = new Inngest({ id: "Project-Management" });

// Prisma schema has `name String` and `image String` (both NOT NULL),
// so never pass null for them.
const buildUserFields = (data) => {
  const email = data?.email_addresses?.[0]?.email_address ?? "";
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ");
  return {
    email,
    name: fullName || email.split("@")[0] || "User",
    image: data.image_url ?? data.profile_image_url ?? "",
  };
};

// Inngest v4: triggers go in the FIRST argument as `triggers`, handler is the second.
const syncUserCreation = inngest.createFunction(
  { id: "Sync-user-from-clerk", triggers: [{ event: "clerk/user.created" }] },
  async ({ event }) => {
    const { data } = event;
    const fields = buildUserFields(data);

    await prisma.user.upsert({
      where: { id: data.id },
      update: fields,
      create: { id: data.id, ...fields },
    });
  }
);

const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk", triggers: [{ event: "clerk/user.deleted" }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.deleteMany({
      where: { id: data.id },
    });
  }
);

const syncUserUpdate = inngest.createFunction(
  { id: "update-user-from-clerk", triggers: [{ event: "clerk/user.updated" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.updateMany({
      where: { id: data.id },
      data: buildUserFields(data),
    });
  }
);

// ---------------------------------------------------------------------------
// Workspaces (Clerk organizations)
//
// Ordering note: Clerk can deliver `organization.created` before the user's
// `user.created` has been processed, and `organizationMembership.created`
// before the workspace exists. The foreign keys will make those runs throw;
// Inngest retries failed runs automatically, so they succeed once the
// parent row is there.
// ---------------------------------------------------------------------------

const toWorkspaceRole = (clerkRole) => (clerkRole === "org:admin" ? "ADMIN" : "MEMBER");

const syncWorkspaceCreation = inngest.createFunction(
  { id: "sync-workspace-from-clerk", triggers: [{ event: "clerk/organization.created" }] },
  async ({ event }) => {
    const { data } = event;

    const fields = {
      name: data.name,
      slug: data.slug,
      image_url: data.image_url ?? "",
    };

    await prisma.workspace.upsert({
      where: { id: data.id },
      update: fields,
      create: { id: data.id, ownerId: data.created_by, ...fields },
    });

    // The creator is the admin member of their own workspace.
    await prisma.workspaceMember.upsert({
      where: { userId_workspaceId: { userId: data.created_by, workspaceId: data.id } },
      update: { role: "ADMIN" },
      create: { userId: data.created_by, workspaceId: data.id, role: "ADMIN" },
    });
  }
);

const syncWorkspaceUpdate = inngest.createFunction(
  { id: "update-workspace-from-clerk", triggers: [{ event: "clerk/organization.updated" }] },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.updateMany({
      where: { id: data.id },
      data: {
        name: data.name,
        slug: data.slug,
        image_url: data.image_url ?? "",
      },
    });
  }
);

const syncWorkspaceDeletion = inngest.createFunction(
  { id: "delete-workspace-from-clerk", triggers: [{ event: "clerk/organization.deleted" }] },
  async ({ event }) => {
    const { data } = event;

    // Members, projects, tasks etc. go with it via onDelete: Cascade.
    await prisma.workspace.deleteMany({
      where: { id: data.id },
    });
  }
);

const syncWorkspaceMemberCreation = inngest.createFunction(
  {
    id: "sync-workspace-member-from-clerk",
    triggers: [{ event: "clerk/organizationMembership.created" }],
  },
  async ({ event }) => {
    const { data } = event;
    const userId = data.public_user_data?.user_id;
    const workspaceId = data.organization?.id;
    const role = toWorkspaceRole(data.role);

    await prisma.workspaceMember.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      update: { role },
      create: { userId, workspaceId, role },
    });
  }
);

const syncWorkspaceMemberUpdate = inngest.createFunction(
  {
    id: "update-workspace-member-from-clerk",
    triggers: [{ event: "clerk/organizationMembership.updated" }],
  },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspaceMember.updateMany({
      where: {
        userId: data.public_user_data?.user_id,
        workspaceId: data.organization?.id,
      },
      data: { role: toWorkspaceRole(data.role) },
    });
  }
);

const syncWorkspaceMemberDeletion = inngest.createFunction(
  {
    id: "delete-workspace-member-from-clerk",
    triggers: [{ event: "clerk/organizationMembership.deleted" }],
  },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspaceMember.deleteMany({
      where: {
        userId: data.public_user_data?.user_id,
        workspaceId: data.organization?.id,
      },
    });
  }
);

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdate,
  syncWorkspaceCreation,
  syncWorkspaceUpdate,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
  syncWorkspaceMemberUpdate,
  syncWorkspaceMemberDeletion,
];
