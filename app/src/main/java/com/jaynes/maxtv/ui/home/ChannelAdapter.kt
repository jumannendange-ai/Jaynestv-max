package com.jaynes.maxtv.ui.home

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.jaynes.maxtv.R
import com.jaynes.maxtv.databinding.ItemChannelBinding
import com.jaynes.maxtv.model.Channel

class ChannelAdapter(
    private val onChannelClick: (Channel) -> Unit
) : ListAdapter<Channel, ChannelAdapter.ChannelVH>(DIFF) {

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<Channel>() {
            override fun areItemsTheSame(a: Channel, b: Channel) = a.id == b.id
            override fun areContentsTheSame(a: Channel, b: Channel) = a == b
        }
    }

    inner class ChannelVH(val b: ItemChannelBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(ch: Channel) {
            b.tvChName.text = ch.name
            b.tvChCat.text  = ch.category.uppercase()

            // Badge
            if (ch.locked) {
                b.tvBadge.text = "PREMIUM"
                b.tvBadge.setBackgroundResource(R.drawable.bg_badge_premium)
            } else {
                b.tvBadge.text = "FREE"
                b.tvBadge.setBackgroundResource(R.drawable.bg_badge_free)
            }

            // Lock overlay
            b.viewLock.visibility = if (ch.locked) android.view.View.VISIBLE else android.view.View.GONE

            // Logo
            if (!ch.logo.isNullOrEmpty()) {
                Glide.with(b.root)
                    .load(ch.logo)
                    .diskCacheStrategy(DiskCacheStrategy.ALL)
                    .placeholder(R.drawable.ic_channel_placeholder)
                    .error(R.drawable.ic_channel_placeholder)
                    .into(b.ivLogo)
            } else {
                b.ivLogo.setImageResource(R.drawable.ic_channel_placeholder)
            }

            b.root.setOnClickListener { onChannelClick(ch) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChannelVH {
        val b = ItemChannelBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ChannelVH(b)
    }

    override fun onBindViewHolder(holder: ChannelVH, position: Int) {
        holder.bind(getItem(position))
    }
}
