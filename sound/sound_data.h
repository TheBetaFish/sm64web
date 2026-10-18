#ifndef SOUND_DATA_H
#define SOUND_DATA_H

extern unsigned char gSoundDataADSR[];
extern unsigned char gSoundDataRaw[];
extern unsigned char gMusicData[];

#ifndef VERSION_SH
extern unsigned char gBankSetsData[];
#endif

#ifdef __EMSCRIPTEN__
void web_audio_log_asset_sizes(unsigned int sequenceCount);
#endif

#endif
