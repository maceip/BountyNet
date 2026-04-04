package net.bountynet.app.junglegym

import android.content.Context
import java.io.File

/**
 * On-device target: **Gemma 4E 4B** via LiteRT-LM (offline inference).
 *
 * **Do not** download or bundle the checkpoint until you sync weights & licensing.
 * The Junglegym runs in [MockLiteRtLmFacade] mode until [expectedWeightsPresent] is true.
 */
object GemmaModelContract {
    const val MODEL_SLUG = "gemma4e4b"
    const val MODEL_DISPLAY_NAME = "Gemma 4E 4B"
    const val LITERT_LM_RUNTIME_LABEL = "LiteRT-LM"

    /** Expected relative path under [Context.getFilesDir] after you add weights manually. */
    const val WEIGHTS_RELATIVE_PATH = "models/gemma-4e-4b/model.litertlm"

    fun expectedWeightsFile(context: Context): File =
        File(context.filesDir, WEIGHTS_RELATIVE_PATH)

    fun expectedWeightsPresent(context: Context): Boolean =
        expectedWeightsFile(context).isFile && expectedWeightsFile(context).length() > 0
}
