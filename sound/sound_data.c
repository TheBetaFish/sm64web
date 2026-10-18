#include "sound_data.h"
#include "pc/rom_assets.h"
#ifdef __EMSCRIPTEN__
#include <stdio.h>
#endif

#define SAMPLES_SIZE 0x5b8200
#define SEQUENCES_SIZE 0x1ca00

unsigned char gSoundDataADSR[] = {
#include "sound/sound_data.ctl.inc.c"
};

unsigned char gSoundDataRaw[SAMPLES_SIZE] = {
#include "sound/sound_data.tbl.inc.c"
};

unsigned char gMusicData[SEQUENCES_SIZE] = {
#include "sound/sequences.bin.inc.c"
};

#ifndef VERSION_SH
unsigned char gBankSetsData[] = {
#include "sound/bank_sets.inc.c"
};
#endif

#ifdef __EMSCRIPTEN__
void web_audio_log_asset_sizes(unsigned int sequenceCount) {
    fprintf(stderr,
            "WEB TRACE: audio assets ADSR=%p size=%u RAW=%p size=%u MUSIC=%p size=%u bankSets=%p sequences=%u\n",
            (void *)gSoundDataADSR, (unsigned)sizeof(gSoundDataADSR),
            (void *)gSoundDataRaw, (unsigned)sizeof(gSoundDataRaw),
            (void *)gMusicData, (unsigned)sizeof(gMusicData),
            (void *)gBankSetsData, sequenceCount);
}
#endif
