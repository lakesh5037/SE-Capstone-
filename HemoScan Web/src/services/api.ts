// Shared PHP Backend Client Integration

export interface BaseResponse {
  status: 'success' | 'error';
  message: string;
}

export interface LoginResponse extends BaseResponse {
  name?: string;
  mobile?: string;
  gender?: string;
  specialty?: string;
  profile_image?: string;
  bio?: string;
  hospital?: string;
  license?: string;
  years_exp?: number;
  dark_mode?: number;
  language?: string;
  daily_summary?: number;
  sound?: number;
  vibration?: number;
  theme_mode?: number;
}

export interface ScanItemDto {
  id: string;
  doctor_email: string;
  patient_id: string;
  patient_name: string;
  patient_age: string;
  patient_gender: string;
  result: string;
  risk_level: string;
  image_path: string;
  date_added: string;
  time_added: string;
  created_at?: string;
}

export interface ScanResponse extends BaseResponse {
  data: ScanItemDto[];
  page?: number;
  limit?: number;
  count?: number;
  server_time?: number;
}

export interface TicketResponse extends BaseResponse {
  ticket_number?: string;
  email_sent?: boolean;
}

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  type: string;
  reference_id: string | null;
  is_read: number;
  created_at: string;
}

export interface NotificationsResponse extends BaseResponse {
  unread_count: number;
  count: number;
  data: NotificationItem[];
}

// Get dynamic API base URL from storage
// Default: localhost (for web browser on same PC as XAMPP)
// Change via Settings if you need a remote/network URL
export const getApiBaseUrl = (): string => {
  return localStorage.getItem('hemoscan_api_url') || 'http://localhost/brainscan_api/';
};

export const setApiBaseUrl = (url: string) => {
  let formattedUrl = url.trim();
  if (formattedUrl && !formattedUrl.endsWith('/')) {
    formattedUrl += '/';
  }
  localStorage.setItem('hemoscan_api_url', formattedUrl);
};

// Lenient response text cleanup (PHP servers sometimes output warnings or extra whitespaces)
const parseLenientJson = async (response: Response): Promise<any> => {
  const text = await response.text();
  try {
    // Attempt clean parse
    return JSON.parse(text);
  } catch (e) {
    // If fail, find the first '{' and last '}' to strip warning headers/footers
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const cleanJson = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(cleanJson);
      } catch (err) {
        throw new Error(`Invalid JSON response: ${text}`);
      }
    }
    throw new Error(`Failed to parse response: ${text}`);
  }
};

// Local query cache to enable rapid, zero-delay responses
interface CacheEntry {
  timestamp: number;
  data: ScanItemDto[];
}
const scanCache: Record<string, CacheEntry> = {};
const CACHE_LIFETIME_MS = 10000; // 10 seconds cache

export const apiService = {
  // 1. Check User Session (checks if local email is still valid)
  checkUser: async (email: string): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);

    const response = await fetch(`${getApiBaseUrl()}check_user.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    const data = await parseLenientJson(response);
    if (data.status === 'success' && data.user) {
      return {
        status: 'success',
        message: data.message || '',
        ...data.user
      };
    }
    return data;
  },

  // 2. Login
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);

    const response = await fetch(`${getApiBaseUrl()}login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    const data = await parseLenientJson(response);
    if (data.status === 'success' && data.user) {
      return {
        status: 'success',
        message: data.message || '',
        ...data.user
      };
    }
    return data;
  },

  // 3. Send OTP
  sendOtp: async (email: string, action: string): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('action', action);

    const response = await fetch(`${getApiBaseUrl()}send_otp.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },

  // 4. Verify OTP
  verifyOtp: async (email: string, otpCode: string, action: string): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('otp_code', otpCode);
    formData.append('action', action);

    const response = await fetch(`${getApiBaseUrl()}verify_otp.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },

  // 5. Signup
  signup: async (
    name: string,
    email: string,
    mobile: string,
    gender: string,
    password: string,
    otpCode: string
  ): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('mobile', mobile);
    formData.append('gender', gender);
    formData.append('password', password);
    formData.append('otp_code', otpCode);

    const response = await fetch(`${getApiBaseUrl()}signup.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },

  // 6. Reset Password
  resetPassword: async (email: string, otpCode: string, newPassword: string): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('otp_code', otpCode);
    formData.append('new_password', newPassword);

    const response = await fetch(`${getApiBaseUrl()}reset_password.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },

  // 7. Get Patient Scans (with client-side cache fallback)
  getPatientScans: async (
    doctorEmail: string,
    patientId: string | null = null,
    patientName: string | null = null,
    patientAge: string | null = null,
    patientGender: string | null = null,
    ignoreCache: boolean = false
  ): Promise<ScanResponse> => {
    const queryParams = new URLSearchParams();
    queryParams.append('doctor_email', doctorEmail);
    if (patientId) queryParams.append('patient_id', patientId);
    if (patientName) queryParams.append('patient_name', patientName);
    if (patientAge) queryParams.append('patient_age', patientAge);
    if (patientGender) queryParams.append('patient_gender', patientGender);

    const queryString = queryParams.toString();
    const now = Date.now();

    // Zero-delay Cache hit check
    if (!ignoreCache && scanCache[queryString] && (now - scanCache[queryString].timestamp < CACHE_LIFETIME_MS)) {
      return { status: 'success', message: 'Loaded from cache', data: scanCache[queryString].data };
    }

    const response = await fetch(`${getApiBaseUrl()}get_scans.php?${queryString}`, {
      method: 'GET',
    });
    const parsedData = await parseLenientJson(response);

    if (parsedData.status === 'success' && parsedData.data) {
      scanCache[queryString] = {
        timestamp: now,
        data: parsedData.data,
      };
    }
    return parsedData;
  },

  // 8. Upload Scan
  uploadScan: async (
    doctorEmail: string,
    patientId: string,
    patientName: string,
    patientAge: string,
    patientGender: string,
    result: string,
    riskLevel: string,
    imageFile: File
  ): Promise<BaseResponse> => {
    const formData = new FormData();
    formData.append('doctor_email', doctorEmail);
    formData.append('patient_id', patientId);
    formData.append('patient_name', patientName);
    formData.append('patient_age', patientAge);
    formData.append('patient_gender', patientGender);
    formData.append('result', result);
    formData.append('risk_level', riskLevel);
    formData.append('image', imageFile);

    const response = await fetch(`${getApiBaseUrl()}upload_scan.php`, {
      method: 'POST',
      body: formData,
    });
    
    // Clear list cache so new scan shows up instantly
    Object.keys(scanCache).forEach(key => delete scanCache[key]);

    return parseLenientJson(response);
  },

  // 9. Update Profile & Preferences
  updateProfile: async (
    email: string,
    name?: string,
    specialty?: string,
    profileImageFile: File | null = null,
    extraFields: {
      bio?: string;
      hospital?: string;
      license?: string;
      years_exp?: number;
      dark_mode?: number;
      language?: string;
      daily_summary?: number;
      sound?: number;
      vibration?: number;
      theme_mode?: number;
    } = {}
  ): Promise<LoginResponse> => {
    let response: Response;
    const isMultipart = profileImageFile !== null;

    if (isMultipart) {
      const formData = new FormData();
      formData.append('email', email);
      if (name !== undefined) formData.append('name', name);
      if (specialty !== undefined) formData.append('specialty', specialty);
      formData.append('profileImage', profileImageFile);
      
      // Append extra fields
      Object.entries(extraFields).forEach(([key, val]) => {
        if (val !== undefined) formData.append(key, String(val));
      });

      response = await fetch(`${getApiBaseUrl()}update_profile.php`, {
        method: 'POST',
        body: formData,
      });
    } else {
      const formData = new URLSearchParams();
      formData.append('email', email);
      if (name !== undefined) formData.append('name', name);
      if (specialty !== undefined) formData.append('specialty', specialty);

      // Append extra fields
      Object.entries(extraFields).forEach(([key, val]) => {
        if (val !== undefined) formData.append(key, String(val));
      });

      response = await fetch(`${getApiBaseUrl()}update_profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
    }

    const data = await parseLenientJson(response);
    if (data.status === 'success' && data.user) {
      return {
        status: 'success',
        message: data.message || '',
        ...data.user
      };
    }
    return data;
  },

  // 10. Delete Account (requires password confirmation)
  deleteAccount: async (email: string, password: string): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);

    const response = await fetch(`${getApiBaseUrl()}delete_account.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },

  // 11. Change Password (authenticated — requires current password)
  changePassword: async (email: string, oldPassword: string, newPassword: string): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('old_password', oldPassword);
    formData.append('new_password', newPassword);

    const response = await fetch(`${getApiBaseUrl()}change_password.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },

  // 12. Submit Support Ticket
  submitTicket: async (
    email: string,
    category: string,
    message: string
  ): Promise<TicketResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('category', category);
    formData.append('message', message);
    formData.append('platform', 'web');
    formData.append('device', navigator.userAgent.substring(0, 200));

    const response = await fetch(`${getApiBaseUrl()}submit_ticket.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },

  // 13. Get Support Tickets for a doctor
  getTickets: async (email: string): Promise<BaseResponse> => {
    const response = await fetch(`${getApiBaseUrl()}get_tickets.php?email=${encodeURIComponent(email)}`);
    return parseLenientJson(response);
  },

  // 14. Save FCM push token (web)
  saveFcmToken: async (email: string, token: string): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('token', token);
    formData.append('platform', 'web');

    const response = await fetch(`${getApiBaseUrl()}save_fcm_token.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },

  // 15. Delete a scan (cross-platform — removes from DB + disk)
  deleteScan: async (scanId: string, doctorEmail: string): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('scan_id', scanId);
    formData.append('doctor_email', doctorEmail);

    const response = await fetch(`${getApiBaseUrl()}delete_scan.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    // Bust the scan cache so list refreshes immediately
    Object.keys(scanCache).forEach(key => delete scanCache[key]);
    return parseLenientJson(response);
  },

  // 16. Get notifications for a doctor
  getNotifications: async (
    email: string,
    unreadOnly: boolean = false
  ): Promise<NotificationsResponse> => {
    const url = `${getApiBaseUrl()}get_notifications.php?email=${encodeURIComponent(email)}${unreadOnly ? '&unread_only=1' : ''}`;
    const response = await fetch(url);
    return parseLenientJson(response);
  },

  // 17. Mark notification(s) as read
  markNotificationRead: async (
    email: string,
    id: number | 'all'
  ): Promise<BaseResponse> => {
    const formData = new URLSearchParams();
    formData.append('email', email);
    if (id === 'all') {
      formData.append('all', '1');
    } else {
      formData.append('id', String(id));
    }

    const response = await fetch(`${getApiBaseUrl()}mark_notification_read.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    return parseLenientJson(response);
  },
};
