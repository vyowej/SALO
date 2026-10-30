import { config } from '../config';
import { apiRequest } from './apiClient';

const STORAGE_KEY = 'salo-restaurant-applications-v1';
const wait = () => new Promise((resolve) => setTimeout(resolve, config.mockDelay));

const readMockApplications = () => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

const saveMockApplications = (applications) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
};

const mockApplication = (userId) => ({
  id: `mock-${userId}`,
  status: 'draft',
  application_type: 'initial',
  details: {},
  photos: { logo_url: null, cover_url: null },
  documents: [],
  review_notes: null,
  submitted_at: null,
  restaurant_id: null,
});

const updateMockApplication = (userId, id, update) => {
  const applications = readMockApplications();
  const application = applications[userId];
  if (!application || application.id !== id) throw new Error('Restaurant application not found.');
  if (!['draft', 'needs_revision'].includes(application.status)) {
    throw new Error('This application is no longer editable.');
  }
  const next = update(application);
  applications[userId] = next;
  saveMockApplications(applications);
  return next;
};

const multipart = (entries) => {
  const form = new FormData();
  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, value);
  });
  return form;
};

export const restaurantApplicationService = {
  async getOrCreate(userId) {
    if (!config.useMock) return apiRequest('/applications/restaurants', { method: 'POST', body: {} });
    await wait();
    const applications = readMockApplications();
    if (applications[userId]) return applications[userId];
    const created = mockApplication(userId);
    applications[userId] = created;
    saveMockApplications(applications);
    return created;
  },

  async getMine(userId) {
    if (!config.useMock) return apiRequest('/applications/restaurants/mine');
    return this.getOrCreate(userId);
  },

  async update(userId, applicationId, details) {
    if (!config.useMock) {
      return apiRequest(`/applications/restaurants/${encodeURIComponent(applicationId)}`, {
        method: 'PATCH',
        body: { draft_details: details },
      });
    }
    await wait();
    return updateMockApplication(userId, applicationId, (application) => ({
      ...application,
      details: { ...application.details, ...details },
    }));
  },

  async sendBusinessEmailOtp(userId, applicationId) {
    if (!config.useMock) {
      return apiRequest(`/applications/restaurants/${encodeURIComponent(applicationId)}/business-email/otp`, {
        method: 'POST',
        body: {},
      });
    }
    await wait();
    const applications = readMockApplications();
    const application = applications[userId];
    if (!application || application.id !== applicationId) throw new Error('Restaurant application not found.');
    return { message: 'Mock verification code: 123456' };
  },

  async verifyBusinessEmail(userId, applicationId, code) {
    if (!config.useMock) {
      return apiRequest(`/applications/restaurants/${encodeURIComponent(applicationId)}/business-email/verify`, {
        method: 'POST',
        body: { code },
      });
    }
    await wait();
    if (code !== '123456') throw new Error('The verification code is invalid or has expired.');
    return updateMockApplication(userId, applicationId, (application) => ({
      ...application,
      details: {
        ...application.details,
        business_email_verified: true,
        business_email_verified_email: application.details.business_email?.trim().toLowerCase(),
        business_email_verified_at: new Date().toISOString(),
      },
    }));
  },

  async uploadDocument(userId, applicationId, docType, file) {
    if (!config.useMock) {
      return apiRequest(`/applications/restaurants/${encodeURIComponent(applicationId)}/documents`, {
        method: 'POST',
        body: multipart({ doc_type: docType, file }),
      });
    }
    await wait();
    return updateMockApplication(userId, applicationId, (application) => ({
      ...application,
      documents: [
        ...application.documents.filter((document) => document.doc_type !== docType),
        { id: `${docType}-${Date.now()}`, doc_type: docType, file_name: file.name, size: file.size, status: 'pending' },
      ],
    }));
  },

  async removeDocument(userId, applicationId, documentId) {
    if (!config.useMock) {
      return apiRequest(`/applications/restaurants/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentId)}`, {
        method: 'DELETE',
      });
    }
    await wait();
    return updateMockApplication(userId, applicationId, (application) => ({
      ...application,
      documents: application.documents.filter((document) => document.id !== documentId),
    }));
  },

  async uploadPhoto(userId, applicationId, kind, file) {
    if (!config.useMock) {
      return apiRequest(`/applications/restaurants/${encodeURIComponent(applicationId)}/photos`, {
        method: 'POST',
        body: multipart({ kind, file }),
      });
    }
    await wait();
    return updateMockApplication(userId, applicationId, (application) => ({
      ...application,
      photos: { ...application.photos, [`${kind}_url`]: null },
      details: { ...application.details, [`${kind}_name`]: file.name },
    }));
  },

  async submit(userId, applicationId, declaredBir) {
    if (!config.useMock) {
      return apiRequest(`/applications/restaurants/${encodeURIComponent(applicationId)}/submit`, {
        method: 'POST',
        body: { confirm: true, declared_bir_2303: declaredBir },
      });
    }
    await wait();
    return updateMockApplication(userId, applicationId, (application) => ({
      ...application,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      details: { ...application.details, declared_bir_2303: declaredBir },
    }));
  },
};

export default restaurantApplicationService;
