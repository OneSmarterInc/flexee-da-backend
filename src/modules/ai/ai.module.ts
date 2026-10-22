import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiCall, AiCallSchema } from './ai-use.schema';
import { AiUseService } from './ai-use.service';

/** The house rules for every AI feature (V3 layer 4). */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AiCall.name, schema: AiCallSchema }]),
  ],
  providers: [AiUseService],
  exports: [AiUseService, MongooseModule],
})
export class AiModule {}
