#include <stdio.h>
#include <stdint.h>
#include <SDL2/SDL.h>

#include "audio_api.h"

static SDL_AudioDeviceID dev;
#ifdef __EMSCRIPTEN__
static unsigned int web_audio_play_calls;
#endif

static bool audio_sdl_init(void) {
    if (SDL_Init(SDL_INIT_AUDIO) != 0) {
        fprintf(stderr, "SDL init error: %s\\n", SDL_GetError());
        return false;
    }

    SDL_AudioSpec want, have;
    SDL_zero(want);
    want.freq = 32000;
    want.format = AUDIO_S16SYS;
    want.channels = 2;
    want.samples = 512;
    want.callback = NULL;
    dev = SDL_OpenAudioDevice(NULL, 0, &want, &have, 0);
    if (dev == 0) {
        fprintf(stderr, "SDL_OpenAudio error: %s\\n", SDL_GetError());
        return false;
    }
#ifdef __EMSCRIPTEN__
    fprintf(stderr, "WEB AUDIO: SDL device opened id=%u freq=%d format=%u channels=%u samples=%u status=%d\\n",
            (unsigned)dev, have.freq, (unsigned)have.format, (unsigned)have.channels,
            (unsigned)have.samples, (int)SDL_GetAudioDeviceStatus(dev));
#endif
    SDL_PauseAudioDevice(dev, 0);
    return true;
}

static int audio_sdl_buffered(void) {
    if (dev == 0) return 0;
    return (int)(SDL_GetQueuedAudioSize(dev) / 4);
}

static int audio_sdl_get_desired_buffered(void) {
    return 1100;
}

static void audio_sdl_play(const uint8_t *buf, size_t len) {
    if (dev == 0 || buf == NULL || len == 0) return;
#ifdef __EMSCRIPTEN__
    unsigned int call = ++web_audio_play_calls;
    if (call <= 8) {
        int16_t const *samples = (int16_t const *)buf;
        size_t count = len / sizeof(*samples);
        int peak = 0;
        for (size_t i = 0; i < count; i++) {
            int value = samples[i];
            int magnitude = value < 0 ? -value : value;
            if (magnitude > peak) peak = magnitude;
        }
        fprintf(stderr, "WEB AUDIO: play call=%u bytes=%u samples=%u peak=%d queued_before=%u\\n",
                call, (unsigned)len, (unsigned)count, peak,
                (unsigned)SDL_GetQueuedAudioSize(dev));
    }
#endif
    if (audio_sdl_buffered() < 6000) {
        int result = SDL_QueueAudio(dev, buf, (Uint32)len);
#ifdef __EMSCRIPTEN__
        if (web_audio_play_calls <= 8) {
            fprintf(stderr, "WEB AUDIO: queue result=%d queued_after=%u error=%s\\n",
                    result, (unsigned)SDL_GetQueuedAudioSize(dev), SDL_GetError());
        }
#endif
    }
}

static void audio_sdl_shutdown(void)
{
    if (SDL_WasInit(SDL_INIT_AUDIO)) {
        if (dev != 0) {
            SDL_CloseAudioDevice(dev);
            dev = 0;
        }
        SDL_QuitSubSystem(SDL_INIT_AUDIO);
    }
}

struct AudioAPI audio_sdl = {
    audio_sdl_init,
    audio_sdl_buffered,
    audio_sdl_get_desired_buffered,
    audio_sdl_play,
    audio_sdl_shutdown
};
