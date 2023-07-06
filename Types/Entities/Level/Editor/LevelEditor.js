// TODO: Figure out how Editor should work?
// (Maybe doesn't need its own class?)
function LevelEditor(spec) {
  const { self, ui, goals, sledders, gridlines, coordinateBox, graph, sky } =
    Level(spec)

  const base = _.mix(self)

  // Implicitly pass self to (direct) editable children
  // (goals, sledder) as parent

  /*

Editor flow:

Open level editor (map, URL (edit: true), sinerider.com/?edit)
  - Level -> LevelEditor()
    -> sendEvent('editorEnabled')
    - gridlines always enabled
      -> override selectScreenCoordinates()
        -> if selected, no coordinate box
    - Share button
  
Share -> open dialog w/ serialized JSON with edit: false, name: "Custom"
  - Open as normal, uneditable level


*/

  let editingPath = false

  let editing

  let selection = null
  let selectionIsDeletable = false

  const { inputs, labels } = ui.editorInspector

  function goalDeleted(goal) {
    goals.splice(goals.indexOf(goal), 1)
  }

  function serialize(nick = null) {
    const json = {
      // Version, etc.
      ...base.serialize(),
      defaultExpression: self.currentLatex,
      goals: goals.map((g) => {
        const goalJson = {
          type: g.type,
          x: g.transform.x,
          y: g.transform.y,
        }
        if (g.order) goalJson.order = g.order
        if (g.pathExpression) {
          goalJson.expression = g.pathExpression
          goalJson.expressionLatex = g.pathExpressionLatex
        }
        return goalJson
      }),
    }
    if (sledders[0]) json.x = sledders[0].transform.x
    if (nick) json.nick = nick
    return json
  }

  function awake() {
    // ui.nextButton.setAttribute('hide', true)
    enableEditing()
  }

  function destroy() {
    // ui.nextButton.setAttribute('hide', false)
    hide()
  }

  function hide() {
    ui.editorSpawner.panel.setAttribute('hide', true)
    ui.editorInspector.panel.setAttribute('hide', true)
  }

  function select(
    newSelection,
    attributes = ['start', 'end', 'order', 'timer', 'x', 'y'],
    newSelectionIsDeletable = true,
  ) {
    selection = newSelection
    selectionIsDeletable = newSelectionIsDeletable

    showInspectorPanel()

    const hideOrder = !attributes.includes('order')
    inputs.order.setAttribute('hide', hideOrder)
    labels.order.setAttribute('hide', hideOrder)

    const hideTimer = !attributes.includes('timer')
    inputs.timer.setAttribute('hide', hideTimer)
    labels.timer.setAttribute('hide', hideTimer)

    const hideX = !attributes.includes('x')
    const hideY = !attributes.includes('y')
    inputs.x.setAttribute('hide', hideX)
    inputs.y.setAttribute('hide', hideY)
    labels.position.setAttribute('hide', hideX && hideY)

    const hideStart = !attributes.includes('start')
    labels.start.setAttribute('hide', hideStart)
    inputs.start.setAttribute('hide', hideStart)
    const hideEnd = !attributes.includes('end')
    labels.end.setAttribute('hide', hideEnd)
    inputs.end.setAttribute('hide', hideEnd)

    ui.editorInspector.deleteSelectionButton.setAttribute(
      'hide',
      !selectionIsDeletable,
    )

    update()
  }

  function deselect() {
    self.save()

    selection = null
    selectionIsDeletable = false

    showSpawnerPanel()
  }

  /* UI Events */

  function showSpawnerPanel() {
    ui.editorSpawner.panel.setAttribute('hide', false)
    ui.editorInspector.panel.setAttribute('hide', true)

    ui.editorInspector.panel.classList.remove('editor-sliding-up')
    ui.editorSpawner.panel.classList.remove('editor-sliding-up')
  }

  function showInspectorPanel() {
    ui.editorSpawner.panel.setAttribute('hide', true)
    ui.editorInspector.panel.setAttribute('hide', false)

    ui.editorInspector.panel.classList.remove('editor-sliding-up')
    ui.editorSpawner.panel.classList.remove('editor-sliding-up')
  }

  function update() {
    // Update UI
    inputs.order.value = selection.order ?? ''
    inputs.x.value = selection.x ? selection.x.toFixed(2) : ''
    inputs.y.value = selection.y ? selection.y.toFixed(2) : ''
    inputs.timer.value = selection.timer ?? ''

    // Save to URL
    self.save()
  }

  function addFixedClicked() {
    self.addGoal({ type: 'fixed' })
  }

  function addDynamicClicked() {
    self.addGoal({ type: 'dynamic' })
  }

  function addPathClicked() {
    self.addGoal({ type: 'path' })
  }

  function deleteSelection() {
    if (selection && selectionIsDeletable) {
      selection.destroy()
      deselect()
    }
  }

  function orderInputEdited(event) {
    let data = event.data ? event.data.toUpperCase() : null
    if (!/[a-z]/i.test(data)) {
      event.preventDefault()
      inputs.order.value = ''
      return
    }
    inputs.order.value = data
    if (selection?.setOrder) selection.setOrder(data)
  }

  function timerInputEdited(event) {
    let value
    try {
      value = Number(inputs.timer.value)
    } catch (err) {
      return
    }
    if (selection?.setTimer) selection.setTimer(value)
  }

  function positionXInputEdited(event) {
    let value
    try {
      value = Number(inputs.x.value)
    } catch (err) {
      return
    }
    if (selection?.setX) selection.setX(value)
  }

  function positionYInputEdited(event) {
    let value
    try {
      value = Number(inputs.y.value)
    } catch (err) {
      return
    }
    if (selection?.setY) selection?.setY(value)
  }

  function keydown(key) {
    if (
      document.activeElement == document.body && // Ignore if in text field
      (key === 'Backspace' || key === 'Delete')
    ) {
      deleteSelection()
    }
  }

  function enableEditing() {
    editing = true
    showSpawnerPanel()
    gridlines.active = true
  }

  function disableEditing() {
    gridlines.active = false
    editing = false
    hide()
  }

  function startRunning() {
    disableEditing()
  }

  function stopRunning() {
    enableEditing()
  }

  // TODO: Change these so
  // bar fading in/out isn't visible
  function onLevelFadeOut() {
    console.log('fading out')
    ui.editorInspector.panel.classList.add('editor-sliding-up')
    ui.editorSpawner.panel.classList.add('editor-sliding-up')
  }

  // Overload mouse gridlines behavior
  function onMouseUp() {}

  function onMouseDown() {}

  function onShareButtonClicked() {
    const serialized = serialize('CUSTOM_LEVEL')
    const url =
      location.origin +
      '?' +
      LZString.compressToBase64(JSON.stringify(serialized))
    ui.puzzleLink.value = url
    ui.editorSharingLinkDialog.showModal()
  }

  const graphs = {}

  graphs[graph.isPolar ?? false] = _.clone(graph)

  function setPolar(polar) {
    // TODO: Figure out how this should work.
    // Either PolarGraph should be merged w/ Graph
    // and just use a polar: true/false variable,
    // or there should be a self-contained mechanism
    // for destroying the graph and replacing it
    // with a new one. (W/ saved polar/cartesian expressions.)
    const newGraph =
      graphs[polar] ||
      (graphs[polar] = base.createGraphFromType(polar ? 'polar' : 'cartesian', {
        // Default expressions if not already saved
        expression: polar ? 'theta' : 'x',
      }))
    // This doesn't even work? Draws both, breaks physics
    _.mixIn(graph, newGraph)
    ui.mathFieldLabel.innerText = `${graph.label}=`
  }

  function selectBiome(biomeKey) {
    // HACK: Figure out how this should work.
    sky.destroy()

    // TODO: Set music
    base.loadDatum(BIOMES[biomeKey])
  }

  function setSledderImage(sledderImagePath) {
    const sledder = sledders[0]
    const x = sledder.x,
      y = sledder.y
    sledders.splice(sledders.indexOf(sledder), 1)
    sledder.destroy()
    base.addSledder({
      x,
      y,
      asset: sledderImagePath,
    })
  }

  return self.mix({
    awake,
    goalDeleted,
    serialize,

    setPolar,
    selectBiome,
    setSledderImage,

    keydown,

    onShareButtonClicked,

    onLevelFadeOut,

    startRunning,
    stopRunning,

    onMouseUp,
    onMouseDown,

    // TODO: Remove need for this
    // (effectively global variable)
    get editing() {
      return editing
    },

    get isEditor() {
      return true
    },

    awake,
    destroy,

    get editingPath() {
      return editingPath
    },
    set editingPath(v) {
      editingPath = v
    },

    deselect,
    select,

    addDynamicClicked,
    addFixedClicked,
    addPathClicked,

    orderInputEdited,
    timerInputEdited,
    positionXInputEdited,
    positionYInputEdited,

    deleteSelection,

    update,
  })
}