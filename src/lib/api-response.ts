import { NextResponse } from 'next/server';
import logger from './logger';

/**
 * Standard API Response Wrapper
 * Tüm API'lerden dönen verilerin ve hataların tek tip (KISS) olmasını sağlar.
 * "Senior" Checklist: Error Handling & consistency.
 */
export const apiResponse = {
  /**
   * Başarılı Yanıt (Success)
   */
  success: (data: unknown = null, message: string = "Success", status: number = 200) => {
    return NextResponse.json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    }, { status });
  },

  /**
   * Hata Yanıtı (Error)
   */
  error: (message: string = "Internal Server Error", code: string = "INTERNAL_ERROR", status: number = 500) => {
    // Kritik hataları logla (Monitoring)
    if (status >= 500) {
      logger.error({ code, message, status }, "Critical API Error Occurred");
    }

    return NextResponse.json({
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    }, { status });
  }
};
