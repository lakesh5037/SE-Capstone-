import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiService, getApiBaseUrl, setApiBaseUrl } from './api';

describe('apiService & getApiBaseUrl', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should return default api base url if not set', () => {
    const url = getApiBaseUrl();
    expect(url).toBe('http://localhost/brainscan_api/');
  });

  it('should allow setting and formatting the api base url', () => {
    setApiBaseUrl('http://192.168.1.10/api');
    expect(getApiBaseUrl()).toBe('http://192.168.1.10/api/');
  });

  it('should verify login form request body structures', async () => {
    const mockResponse = { status: 'success', message: 'Logged in successfully', name: 'Dr. Watson' };
    
    // Mock global fetch
    const fetchSpy = vi.fn().mockImplementation(() => 
      Promise.resolve({
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      } as Response)
    );
    vi.stubGlobal('fetch', fetchSpy);

    const email = 'doctor@hemoscan.com';
    const pwd = 'securePassword123';
    const res = await apiService.login(email, pwd);

    expect(res.status).toBe('success');
    expect(res.name).toBe('Dr. Watson');
    
    // Verify fetch arguments
    expect(fetchSpy).toHaveBeenCalledOnce();
    const urlArg = fetchSpy.mock.calls[0][0];
    const initArg = fetchSpy.mock.calls[0][1];
    
    expect(urlArg).toContain('login.php');
    expect(initArg?.method).toBe('POST');
    expect(initArg?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(initArg?.body).toContain('email=doctor%40hemoscan.com');
    expect(initArg?.body).toContain('password=securePassword123');
  });

  it('should utilize client-side cache for patient scans unless ignoreCache is active', async () => {
    const mockScansResponse = {
      status: 'success',
      message: 'Scans loaded',
      data: [
        {
          id: '1',
          doctor_email: 'doctor@hemoscan.com',
          patient_id: 'PAT-001',
          patient_name: 'John Doe',
          patient_age: '35',
          patient_gender: 'Male',
          result: 'Normal',
          risk_level: 'Low Risk',
          image_path: 'scan1.jpg',
          date_added: '2026-06-09'
        }
      ]
    };

    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        text: () => Promise.resolve(JSON.stringify(mockScansResponse))
      } as Response)
    );
    vi.stubGlobal('fetch', fetchSpy);

    // Call 1: Fetches from network
    const res1 = await apiService.getPatientScans('doctor@hemoscan.com');
    expect(res1.status).toBe('success');
    expect(fetchSpy).toHaveBeenCalledOnce();

    // Call 2: Should hit the local cache and NOT query the network again
    const res2 = await apiService.getPatientScans('doctor@hemoscan.com');
    expect(res2.status).toBe('success');
    expect(res2.data.length).toBe(1);
    expect(fetchSpy).toHaveBeenCalledOnce(); // Still 1 call!

    // Call 3: Setting ignoreCache = true should bypass cache and query network again
    const res3 = await apiService.getPatientScans('doctor@hemoscan.com', null, null, null, null, true);
    expect(res3.status).toBe('success');
    expect(fetchSpy).toHaveBeenCalledTimes(2); // Call count increases!
  });
});
