import { z } from "zod";

/*
  Calisma saati / izin govdesinin bicimi -- web action'i, esnafin mobil ucu ve
  yoneticinin mobil ucu AYNI semayi kullanir. Icerik kurali (saat bicimi,
  gecmis tarih, cakisan rezervasyon) `ShopScheduleService`te.
*/
export const weeklyHoursSchema = z.object({
  open247: z.boolean(),
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        isClosed: z.boolean(),
        openingTime: z.string().max(5),
        closingTime: z.string().max(5),
      }),
    )
    .length(7),
});

export const closureInputSchema = z.object({
  startDate: z.string().max(10),
  endDate: z.string().max(10),
  reason: z.string().max(200).optional(),
});
