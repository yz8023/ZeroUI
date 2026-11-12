package com.zeroui.template.feature.settings

import androidx.lifecycle.ViewModel
import com.zeroui.template.data.AppSettings
import com.zeroui.template.data.SettingsRepository
import kotlinx.coroutines.flow.StateFlow

/** Reads and writes [AppSettings] for the settings pages. */
class SettingsViewModel(private val repository: SettingsRepository) : ViewModel() {
    val settings: StateFlow<AppSettings> = repository.settings

    fun update(transform: (AppSettings) -> AppSettings) = repository.update(transform)

    fun resetAppearance() = repository.resetAppearance()

    fun replayWelcome() = repository.update { it.copy(welcomeCompleted = false) }
}
