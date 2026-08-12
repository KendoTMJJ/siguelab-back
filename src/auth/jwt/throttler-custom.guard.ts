import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerCustomGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/require-await -- debe devolver Promise<string> para sobreescribir ThrottlerGuard.getTracker()
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user?.id) {
      return `user-${req.user.id}`;
    }

    return req.ip;
  }
}
