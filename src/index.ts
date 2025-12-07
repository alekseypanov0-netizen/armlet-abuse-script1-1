local Utility = require("Utility")
local Armlet = {}
local option = Menu.AddOption({"Utility"}, "Armlet Abuse", "On/Off")
local optionFarmMode = Menu.AddOption({"Utility"}, "Armlet Farming Mode", "Toggle on armlet when farming (On/Off)")
local safeThreshold = 550
local dangerousThreshold = 100
local lasttime = GameRules.GetGameTime()
local msg_queue = {}

-- List of dangerous DoT modifiers to monitor (e.g., Urn of Shadows, Spirit Vessel, etc.)
local dangerousModifiers = {
"modifier_item_urn_damage",  -- Urn of Shadows damage
"modifier_item_spirit_vessel_damage",  -- Spirit Vessel damage
-- Add more if needed, like "modifier_ice_blast" for AA ult, etc.
}

function Armlet.OnPrepareUnitOrders(orders)
if not Menu.IsEnabled(option) then return true end
if not orders then return true end
local myHero = Heroes.GetLocal()
if not myHero then return true end
if not Utility.IsSuitableToUseItem(myHero) then return true end
local item = NPC.GetItem(myHero, "item_armlet", true)
if not item then return true end
local current = GameRules.GetGameTime()
-- toggle on armlet if about to attack
if not Ability.GetToggleState(item) and (orders.order == Enum.UnitOrder.DOTA_UNIT_ORDER_ATTACK_MOVE or orders.order == Enum.UnitOrder.DOTA_UNIT_ORDER_ATTACK_TARGET) then
-- disable auto farm mode if the option is turned off
if not Menu.IsEnabled(optionFarmMode) and orders.target and NPC.IsCreep(orders.target) then
return true
end
Ability.Toggle(item)
lasttime = current
end
-- toggle off armlet if about to walk
if Ability.GetToggleState(item) and Entity.GetHealth(myHero) >= safeThreshold and (orders.order == Enum.UnitOrder.DOTA_UNIT_ORDER_MOVE_TO_POSITION or orders.order == Enum.UnitOrder.DOTA_UNIT_ORDER_MOVE_TO_TARGET) then
Ability.Toggle(item)
lasttime = current
end
return true
end
function Armlet.OnUpdate()
if not Menu.IsEnabled(option) then return end
local myHero = Heroes.GetLocal()
if not myHero then return end
if not Utility.IsSuitableToUseItem(myHero) then return end
local item = NPC.GetItem(myHero, "item_armlet", true)
if not item then return end
local current = GameRules.GetGameTime()
if Entity.GetHealth(myHero) <= dangerousThreshold and current - lasttime > 0.6 then
Armlet.Toggle()
end
if not msg_queue or #msg_queue <= 0 then return end
local timestamp = table.remove(msg_queue, 1)
local err = 0.05
if math.abs(timestamp - current) <= err then
Ability.Toggle(item)
lasttime = current
elseif timestamp > current + err then
table.insert(msg_queue, timestamp)
end
end
-- right click from range units (range creep, range hero, tower)
function Armlet.OnProjectile(projectile)
if not Menu.IsEnabled(option) then return end
if not projectile or not projectile.source or not projectile.target then return end
if not projectile.isAttack then return end
local myHero = Heroes.GetLocal()
if not myHero then return end
if projectile.target ~= myHero then return end
if Entity.IsSameTeam(projectile.source, myHero) then return end
local true_damage = NPC.GetTrueDamage(projectile.source) * NPC.GetArmorDamageMultiplier(myHero)
if true_damage + dangerousThreshold >= Entity.GetHealth(myHero) and Entity.GetHealth(myHero) > dangerousThreshold then
Armlet.Toggle()
end
end
-- right click from melee units
function Armlet.OnUnitAnimation(animation)
if not Menu.IsEnabled(option) then return end
if not animation or not animation.sequenceName or not animation.unit then return end
local myHero = Heroes.GetLocal()
if not myHero then return end
if Entity.IsSameTeam(animation.unit, myHero) then return end
if NPC.IsRanged(animation.unit) then return end
if not NPC.IsEntityInRange(myHero, animation.unit, 150) then return end
local true_damage = NPC.GetTrueDamage(animation.unit) * NPC.GetArmorDamageMultiplier(myHero)
if true_damage + dangerousThreshold >= Entity.GetHealth(myHero) and Entity.GetHealth(myHero) > dangerousThreshold then
Armlet.Toggle()
end
end
function Armlet.Toggle()
local myHero = Heroes.GetLocal()
if not myHero then return end
local item = NPC.GetItem(myHero, "item_armlet", true)
if not item then return end
local current = GameRules.GetGameTime()
if Ability.GetToggleState(item) then
table.insert(msg_queue, current)
table.insert(msg_queue, current+0.1)
else
table.insert(msg_queue, current)
end
end
-- handler for modifier created to abuse DoT effects
function Armlet.OnModifierCreate(modifier)
if not Menu.IsEnabled(option) then return end
local myHero = Heroes.GetLocal()
if not myHero then return end
if not modifier or not Entity.IsHero(modifier:GetParent()) or modifier:GetParent() ~= myHero then return end

local modName = modifier:GetName()
if not table.contains(dangerousModifiers, modName) then return end

-- Assuming we can get remaining time and tick period from modifier
local remainingTime = modifier:GetRemainingTime()
local elapsedTime = modifier:GetElapsedTime()
local tickPeriod = 1.0  -- Assume 1 second for Urn/Vessel

local current = GameRules.GetGameTime()
local timeSinceLastTick = elapsedTime % tickPeriod
local timeToNextTick = tickPeriod - timeSinceLastTick

local approxTickDamage = 30  -- Placeholder

if Entity.GetHealth(myHero) < 400 then
local numTicksLeft = math.floor(remainingTime / tickPeriod)
for i = 1, numTicksLeft do
local tickTime = current + timeToNextTick + (i - 1) * tickPeriod
table.insert(msg_queue, tickTime - 0.05)
table.insert(msg_queue, tickTime + 0.05)
end
end
end

-- Helper function
function table.contains(t, val)
for _, v in ipairs(t) do
if v == val then return true end
end
return false
end

return Armlet
